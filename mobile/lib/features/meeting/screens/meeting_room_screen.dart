import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import '../../../services/firebase_service.dart';
import '../../../services/livekit_service.dart';

class MeetingRoomScreen extends StatefulWidget {
  final String meetingId;

  const MeetingRoomScreen({super.key, required this.meetingId});

  @override
  State<MeetingRoomScreen> createState() => _MeetingRoomScreenState();
}

class _MeetingRoomScreenState extends State<MeetingRoomScreen> {
  final _liveKit = LiveKitService();
  final _firebase = FirebaseService();
  bool _connecting = true;
  bool _micOn = true;
  bool _camOn = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _joinMeeting();
  }

  Future<void> _joinMeeting() async {
    try {
      final result = await _firebase.getLiveKitToken.call({
        'roomName': widget.meetingId,
      });
      final data = result.data as Map<String, dynamic>;
      final token = data['token'] as String;
      final serverUrl = data['serverUrl'] as String;

      await _liveKit.connect(url: serverUrl, token: token);

      final meetingDoc =
          await _firebase.meetingDoc(widget.meetingId).get();
      if (meetingDoc.exists) {
        final meetingData = meetingDoc.data() as Map<String, dynamic>;
        final roomName = meetingData['roomName'] as String? ?? widget.meetingId;
        if (roomName != widget.meetingId) {
          // Use the actual LiveKit room name if different
        }
      }

      setState(() => _connecting = false);
    } catch (e) {
      setState(() {
        _connecting = false;
        _error = e.toString();
      });
    }
  }

  @override
  void dispose() {
    _liveKit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _connecting
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Colors.white),
                  SizedBox(height: 16),
                  Text('Connecting...', style: TextStyle(color: Colors.white54)),
                ],
              ),
            )
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(_error!,
                          style: const TextStyle(color: Colors.white54)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Back'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: _liveKit.room != null
                          ? _VideoGridView(room: _liveKit.room!)
                          : const Center(
                              child: Text('No video',
                                  style: TextStyle(color: Colors.white54)),
                            ),
                    ),
                    _buildControls(),
                  ],
                ),
    );
  }

  Widget _buildControls() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black87],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ControlButton(
            icon: _micOn ? Icons.mic : Icons.mic_off,
            color: _micOn ? Colors.white : Colors.red,
            onPressed: () {
              _liveKit.toggleMic();
              setState(() => _micOn = !_micOn);
            },
          ),
          const SizedBox(width: 24),
          _ControlButton(
            icon: _camOn ? Icons.videocam : Icons.videocam_off,
            color: _camOn ? Colors.white : Colors.red,
            onPressed: () {
              _liveKit.toggleCamera();
              setState(() => _camOn = !_camOn);
            },
          ),
          const SizedBox(width: 24),
          _ControlButton(
            icon: Icons.flip_camera_android,
            color: Colors.white,
            onPressed: () => _liveKit.switchCamera(),
          ),
          const SizedBox(width: 24),
          _ControlButton(
            icon: Icons.call_end,
            color: Colors.red,
            onPressed: () {
              _liveKit.disconnect();
              Navigator.pop(context);
            },
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;

  const _ControlButton({
    required this.icon,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: color.withOpacity(0.2),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color, size: 28),
      ),
    );
  }
}

class _VideoGridView extends StatelessWidget {
  final Room room;

  const _VideoGridView({required this.room});

  @override
  Widget build(BuildContext context) {
    final participants = room.remoteParticipants.values.toList();
    final hasLocalVideo = room.localParticipant?.isCameraEnabled ?? false;
    final itemCount = participants.length + (hasLocalVideo ? 1 : 0);

    if (itemCount == 0) {
      return const Center(
        child: Text('No participants', style: TextStyle(color: Colors.white54)),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(8),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: itemCount <= 2 ? 1 : 2,
        childAspectRatio: 4 / 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        if (index == 0 && hasLocalVideo) {
          return _VideoTile(
            participant: room.localParticipant!,
            isLocal: true,
          );
        }
        final remoteIndex = hasLocalVideo ? index - 1 : index;
        return _VideoTile(
          participant: participants[remoteIndex],
          isLocal: false,
        );
      },
    );
  }
}

class _VideoTile extends StatefulWidget {
  final Participant participant;
  final bool isLocal;

  const _VideoTile({
    required this.participant,
    required this.isLocal,
  });

  @override
  State<_VideoTile> createState() => _VideoTileState();
}

class _VideoTileState extends State<_VideoTile> {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: const Color(0xFF18181B),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (widget.participant is LocalParticipant)
              _LocalVideoView(participant: widget.participant as LocalParticipant)
            else if (widget.participant is RemoteParticipant)
              _RemoteVideoView(participant: widget.participant as RemoteParticipant)
            else
              const Center(
                child: Icon(Icons.person, size: 48, color: Colors.white24),
              ),
            Positioned(
              left: 8,
              bottom: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.participant.name ?? 'Unknown',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocalVideoView extends StatelessWidget {
  final LocalParticipant participant;

  const _LocalVideoView({required this.participant});

  @override
  Widget build(BuildContext context) {
    return VideoTrackRenderer(
      participant.videoTracks.firstOrNull?.videoTrack,
      fit: BoxFit.cover,
    );
  }
}

class _RemoteVideoView extends StatelessWidget {
  final RemoteParticipant participant;

  const _RemoteVideoView({required this.participant});

  @override
  Widget build(BuildContext context) {
    return VideoTrackRenderer(
      participant.videoTracks.firstOrNull?.videoTrack,
      fit: BoxFit.cover,
    );
  }
}
