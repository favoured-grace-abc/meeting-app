import 'package:livekit_client/livekit_client.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

class LiveKitService {
  Room? _room;
  LocalParticipant? get localParticipant => _room?.localParticipant;
  Room? get room => _room;
  bool get isConnected => _room?.connectionState == ConnectionState connected;

  final ValueNotifier<List<RemoteParticipant>> participants =
      ValueNotifier([]);

  void _updateParticipants() {
    if (_room == null) return;
    participants.value = _room!.remoteParticipants.values.toList();
  }

  Future<void> requestPermissions() async {
    final mic = await Permission.microphone.request();
    final cam = await Permission.camera.request();

    if (kDebugMode) {
      print('Mic permission: ${mic.isGranted}');
      print('Camera permission: ${cam.isGranted}');
    }
  }

  Future<Room> connect({
    required String url,
    required String token,
    VideoTrack? videoTrack,
    AudioTrack? audioTrack,
  }) async {
    await requestPermissions();

    _room = Room(
      roomOptions: RoomOptions(
        defaultVideoPublishOptions: VideoPublishOptions(
          simulcast: true,
        ),
      ),
    );

    _room!.on<RoomEvent>((event) {
      if (event is RoomParticipantConnectedEvent ||
          event is RoomParticipantDisconnectedEvent) {
        _updateParticipants();
      }
    });

    await _room!.connect(
      url,
      token,
      participantOptions: ParticipantOptions(
        name: 'Mobile User',
      ),
    );

    if (await Permission.camera.isGranted) {
      await _room!.localParticipant?.setCameraEnabled(true);
    }
    if (await Permission.microphone.isGranted) {
      await _room!.localParticipant?.setMicrophoneEnabled(true);
    }

    _updateParticipants();
    return _room!;
  }

  Future<void> toggleMic() async {
    if (_room?.localParticipant == null) return;
    final enabled = !_room!.localParticipant!.isMicrophoneEnabled;
    await _room!.localParticipant!.setMicrophoneEnabled(enabled);
  }

  Future<void> toggleCamera() async {
    if (_room?.localParticipant == null) return;
    final enabled = !_room!.localParticipant!.isCameraEnabled;
    await _room!.localParticipant!.setCameraEnabled(enabled);
  }

  Future<void> switchCamera() async {
    await _room?.localParticipant?.switchCamera();
  }

  Future<void> startRecording() async {
    // Recording handled server-side via LiveKit egress
  }

  Future<void> disconnect() async {
    await _room?.disconnect();
    _room = null;
    participants.value = [];
  }

  void dispose() {
    _room?.disconnect();
    _room?.dispose();
    participants.dispose();
  }
}
