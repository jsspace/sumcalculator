import AppKit
import Foundation

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "dist", isDirectory: true)

func renderPNG(size: Int) -> Data {
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    let previous = NSGraphicsContext.current
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let context = NSGraphicsContext.current!.cgContext
    context.scaleBy(x: CGFloat(size) / 64, y: CGFloat(size) / 64)
    context.translateBy(x: 0, y: 64)
    context.scaleBy(x: 1, y: -1)
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)

    let background = CGPath(roundedRect: CGRect(x: 0, y: 0, width: 64, height: 64), cornerWidth: 15, cornerHeight: 15, transform: nil)
    context.addPath(background)
    context.setFillColor(CGColor(red: 16 / 255, green: 26 / 255, blue: 53 / 255, alpha: 1))
    context.fillPath()

    let sigma = CGMutablePath()
    sigma.move(to: CGPoint(x: 44, y: 17))
    sigma.addLine(to: CGPoint(x: 21, y: 17))
    sigma.addLine(to: CGPoint(x: 33, y: 32))
    sigma.addLine(to: CGPoint(x: 21, y: 47))
    sigma.addLine(to: CGPoint(x: 44, y: 47))
    context.addPath(sigma)
    context.setStrokeColor(CGColor(red: 201 / 255, green: 245 / 255, blue: 90 / 255, alpha: 1))
    context.setLineWidth(6)
    context.setLineCap(.round)
    context.setLineJoin(.round)
    context.strokePath()

    context.flush()
    NSGraphicsContext.current = previous
    return bitmap.representation(using: .png, properties: [:])!
}

func appendUInt16(_ value: UInt16, to data: inout Data) {
    data.append(UInt8(value & 0xff))
    data.append(UInt8((value >> 8) & 0xff))
}

func appendUInt32(_ value: UInt32, to data: inout Data) {
    for shift in stride(from: 0, through: 24, by: 8) {
        data.append(UInt8((value >> shift) & 0xff))
    }
}

let files: [(String, Int)] = [
    ("icon.png", 512),
    ("apple-touch-icon.png", 180),
    ("favicon-32.png", 32),
]
for (name, size) in files {
    try renderPNG(size: size).write(to: outputDirectory.appendingPathComponent(name))
}

let icoSizes = [16, 32, 48, 64, 256]
let images = icoSizes.map(renderPNG)
var ico = Data()
appendUInt16(0, to: &ico)
appendUInt16(1, to: &ico)
appendUInt16(UInt16(images.count), to: &ico)
var offset = UInt32(6 + 16 * images.count)
for (index, size) in icoSizes.enumerated() {
    ico.append(UInt8(size == 256 ? 0 : size))
    ico.append(UInt8(size == 256 ? 0 : size))
    ico.append(0)
    ico.append(0)
    appendUInt16(1, to: &ico)
    appendUInt16(32, to: &ico)
    appendUInt32(UInt32(images[index].count), to: &ico)
    appendUInt32(offset, to: &ico)
    offset += UInt32(images[index].count)
}
for image in images { ico.append(image) }
try ico.write(to: outputDirectory.appendingPathComponent("favicon.ico"))
