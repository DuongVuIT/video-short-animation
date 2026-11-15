// Synthesize one line with a macOS voice and record each word's sample offset.
// usage: swift tts.swift <voice identifier> <rate 0..1> <text> <out.caf> <words.json>
import AVFoundation
import Foundation

let a = CommandLine.arguments
let (voiceId, rate, text, outPath, jsonPath) = (a[1], Float(a[2])!, a[3], a[4], a[5])
guard let voice = AVSpeechSynthesisVoice(identifier: voiceId) else {
  fputs("voice \(voiceId) not found\n", stderr); exit(2)
}
let u = AVSpeechUtterance(string: text)
u.voice = voice
u.rate = rate
let synth = AVSpeechSynthesizer()
var file: AVAudioFile? = nil
var frames: Int64 = 0
var sr = 0.0
var bytesPerFrame = 0
var words: [[String: Any]] = []
var finished = false
synth.write(u, toBufferCallback: { buf in
  guard let pcm = buf as? AVAudioPCMBuffer else { return }
  if pcm.frameLength == 0 { finished = true; return }
  if file == nil {
    sr = pcm.format.sampleRate
    bytesPerFrame = Int(pcm.format.streamDescription.pointee.mBytesPerFrame)
    file = try! AVAudioFile(forWriting: URL(fileURLWithPath: outPath), settings: pcm.format.settings,
                            commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved)
  }
  try! file!.write(from: pcm)
  frames += Int64(pcm.frameLength)
}, toMarkerCallback: { marks in
  for m in marks where m.mark == .word {
    let r = Range(m.textRange, in: text)
    words.append(["w": r.map { String(text[$0]) } ?? "", "offset": m.byteSampleOffset, "loc": m.textRange.location])
  }
})
let deadline = Date().addingTimeInterval(60)
while !finished && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
let out: [String: Any] = ["voice": voice.identifier, "sr": sr, "bytesPerFrame": bytesPerFrame, "frames": frames, "words": words]
try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted]).write(to: URL(fileURLWithPath: jsonPath))
print("ok \(voice.identifier) sr=\(sr) frames=\(frames) dur=\(Double(frames) / max(sr, 1)) words=\(words.count)")
