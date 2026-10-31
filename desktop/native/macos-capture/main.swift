import Foundation
import CoreGraphics
import ImageIO
import Vision

struct LineResult: Codable {
    let text: String
    let confidence: Float
    let box: [Double] // [x, y, width, height] normalized
}

struct OcrOutput: Codable {
    let success: Bool
    let text: String
    let lines: [LineResult]
    let error: String?
}

struct DisplayInfo: Codable {
    let id: UInt32
    let width: Int
    let height: Int
    let isMain: Bool
}

struct DisplaysOutput: Codable {
    let success: Bool
    let displays: [DisplayInfo]
    let error: String?
}

func printJson<T: Encodable>(_ value: T) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted]
    if let data = try? encoder.encode(value), let str = String(data: data, encoding: .utf8) {
        print(str)
    } else {
        print("{\"success\":false,\"error\":\"JSON encoding failed\"}")
    }
}

func performOCR(imagePath: String) {
    let url = URL(fileURLWithPath: imagePath)
    guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        printJson(OcrOutput(success: false, text: "", lines: [], error: "Failed to load image at \(imagePath)"))
        return
    }

    let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNRecognizeTextRequest { request, error in
        if let error = error {
            printJson(OcrOutput(success: false, text: "", lines: [], error: error.localizedDescription))
            return
        }

        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            printJson(OcrOutput(success: true, text: "", lines: [], error: nil))
            return
        }

        var lines: [LineResult] = []
        var fullText = ""

        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            let box: [Double] = [
                Double(observation.boundingBox.origin.x),
                Double(observation.boundingBox.origin.y),
                Double(observation.boundingBox.size.width),
                Double(observation.boundingBox.size.height)
            ]
            lines.append(LineResult(text: topCandidate.string, confidence: topCandidate.confidence, box: box))
            if !fullText.isEmpty {
                fullText.append("\n")
            }
            fullText.append(topCandidate.string)
        }

        printJson(OcrOutput(success: true, text: fullText, lines: lines, error: nil))
    }

    request.recognitionLevel = VNRequestTextRecognitionLevel.accurate
    request.usesLanguageCorrection = true

    do {
        try requestHandler.perform([request])
    } catch {
        printJson(OcrOutput(success: false, text: "", lines: [], error: error.localizedDescription))
    }
}

func listDisplays() {
    var displayCount: UInt32 = 0
    let maxDisplays: UInt32 = 16
    var activeDisplays = [CGDirectDisplayID](repeating: 0, count: Int(maxDisplays))

    let result = CGGetActiveDisplayList(maxDisplays, &activeDisplays, &displayCount)
    if result != .success {
        printJson(DisplaysOutput(success: false, displays: [], error: "CGGetActiveDisplayList failed: \(result.rawValue)"))
        return
    }

    let mainDisplay = CGMainDisplayID()
    var displayList: [DisplayInfo] = []

    for i in 0..<Int(displayCount) {
        let dId = activeDisplays[i]
        let width = CGDisplayPixelsWide(dId)
        let height = CGDisplayPixelsHigh(dId)
        displayList.append(DisplayInfo(id: dId, width: width, height: height, isMain: dId == mainDisplay))
    }

    printJson(DisplaysOutput(success: true, displays: displayList, error: nil))
}

func main() {
    let args = CommandLine.arguments
    if args.count < 2 {
        print("Usage:")
        print("  mac-vision-helper ocr <image-path>")
        print("  mac-vision-helper list-displays")
        exit(1)
    }

    let command = args[1]
    switch command {
    case "ocr":
        if args.count < 3 {
            print("Error: Missing image path")
            exit(1)
        }
        performOCR(imagePath: args[2])
    case "list-displays":
        listDisplays()
    default:
        print("Unknown command: \(command)")
        exit(1)
    }
}

main()
