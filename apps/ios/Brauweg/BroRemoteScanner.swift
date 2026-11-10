import AVFoundation
import UIKit

final class BroRemoteScanner: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var fertig: ((String?) -> Void)?
    private let sitzung = AVCaptureSession()
    private let kameraQueue = DispatchQueue(label: "de.brauweg.broremote.kamera")
    private var vorschau: AVCaptureVideoPreviewLayer?
    private var erledigt = false
    private let hinweis = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let abbrechen = UIButton(type: .system)
        abbrechen.setTitle("Abbrechen", for: .normal)
        abbrechen.tintColor = .white
        abbrechen.addTarget(self, action: #selector(abbruch), for: .touchUpInside)
        hinweis.text = "Scanne den QR-Code in der BroRemote-Lobby."
        hinweis.textColor = .white; hinweis.numberOfLines = 0; hinweis.textAlignment = .center
        for element in [abbrechen, hinweis] {
            element.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(element)
        }
        NSLayoutConstraint.activate([
            abbrechen.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            abbrechen.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            hinweis.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            hinweis.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            hinweis.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -32),
        ])
        AVCaptureDevice.requestAccess(for: .video) { [weak self] erlaubt in
            DispatchQueue.main.async {
                guard let self, !self.erledigt else { return }
                if erlaubt { self.starten() }
                else { self.hinweis.text = "Kamerazugriff fehlt. Erlaube ihn in den iOS-Einstellungen oder füge den Einladungslink in BroRemote ein." }
            }
        }
    }

    private func starten() {
        guard let kamera = AVCaptureDevice.default(for: .video), let eingang = try? AVCaptureDeviceInput(device: kamera), sitzung.canAddInput(eingang) else {
            hinweis.text = "Keine Kamera verfügbar. Du kannst stattdessen den Einladungslink einfügen."; return
        }
        sitzung.addInput(eingang)
        let ausgang = AVCaptureMetadataOutput()
        guard sitzung.canAddOutput(ausgang) else { return }
        sitzung.addOutput(ausgang)
        ausgang.setMetadataObjectsDelegate(self, queue: .main)
        ausgang.metadataObjectTypes = [.qr]
        let v = AVCaptureVideoPreviewLayer(session: sitzung)
        v.videoGravity = .resizeAspectFill; v.frame = view.bounds
        view.layer.insertSublayer(v, at: 0); vorschau = v
        kameraQueue.async { [sitzung] in sitzung.startRunning() }
    }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); vorschau?.frame = view.bounds }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); beenden(nil) }
    @objc private func abbruch() { beenden(nil) }
    private func beenden(_ text: String?) {
        guard !erledigt else { return }; erledigt = true
        kameraQueue.async { [sitzung] in sitzung.stopRunning() }
        fertig?(text)
        dismiss(animated: true)
    }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let text = (metadataObjects.first as? AVMetadataMachineReadableCodeObject)?.stringValue, text.count <= 500 else { return }
        beenden(text)
    }
}
