import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../services/firebase_service.dart';

class MeetingListScreen extends StatefulWidget {
  const MeetingListScreen({super.key});

  @override
  State<MeetingListScreen> createState() => _MeetingListScreenState();
}

class _MeetingListScreenState extends State<MeetingListScreen> {
  final _service = FirebaseService();

  @override
  Widget build(BuildContext context) {
    final userId = _service.currentUser?.uid;
    if (userId == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/login'));
      return const Scaffold(body: SizedBox());
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('MeetFlow'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await _service.signOut();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _service.meetings
            .where('hostId', isEqualTo: userId)
            .orderBy('createdAt', descending: true)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final meetings = snapshot.data?.docs ?? [];

          if (meetings.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.videocam_off, size: 64,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                  const SizedBox(height: 16),
                  Text(
                    'No meetings yet',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Start or schedule a meeting',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: meetings.length,
            itemBuilder: (context, index) {
              final data = meetings[index].data() as Map<String, dynamic>;
              final status = data['status'] as String? ?? 'ended';
              final isActive = status == 'active';
              final isScheduled = status == 'scheduled';

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  leading: Container(
                    width: 4,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color: isActive
                          ? Colors.green
                          : isScheduled
                              ? Colors.amber
                              : Colors.grey,
                    ),
                  ),
                  title: Text(
                    data['title'] as String? ?? 'Untitled Meeting',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  subtitle: Text(
                    data['description'] as String? ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  trailing: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isActive
                          ? Colors.green
                          : isScheduled
                              ? Colors.amber
                              : Colors.grey,
                    ),
                  ),
                  onTap: isActive
                      ? () => context.go('/meeting/${meetings[index].id}')
                      : null,
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'schedule',
            onPressed: () => _showScheduleDialog(context),
            child: const Icon(Icons.calendar_today),
          ),
          const SizedBox(height: 12),
          FloatingActionButton(
            heroTag: 'instant',
            onPressed: () async {
              try {
                final result =
                    await _service.createInstantMeeting.call();
                final data = result.data as Map<String, dynamic>;
                if (context.mounted) {
                  context.go('/meeting/${data['meetingId']}');
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e')),
                  );
                }
              }
            },
            child: const Icon(Icons.videocam),
          ),
        ],
      ),
    );
  }

  void _showScheduleDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const _ScheduleMeetingDialog(),
    );
  }
}

class _ScheduleMeetingDialog extends StatefulWidget {
  const _ScheduleMeetingDialog();

  @override
  State<_ScheduleMeetingDialog> createState() => _ScheduleMeetingDialogState();
}

class _ScheduleMeetingDialogState extends State<_ScheduleMeetingDialog> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _selectedTime = const TimeOfDay(hour: 9, minute: 0);
  bool _saving = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Schedule Meeting'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            ListTile(
              title: const Text('Date'),
              subtitle: Text(
                '${_selectedDate.month}/${_selectedDate.day}/${_selectedDate.year}',
              ),
              trailing: const Icon(Icons.calendar_month),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (date != null) setState(() => _selectedDate = date);
              },
            ),
            ListTile(
              title: const Text('Time'),
              subtitle: Text(_selectedTime.format(context)),
              trailing: const Icon(Icons.access_time),
              onTap: () async {
                final time = await showTimePicker(
                  context: context,
                  initialTime: _selectedTime,
                );
                if (time != null) setState(() => _selectedTime = time);
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _saving
              ? null
              : () async {
                  final title = _titleCtrl.text.trim();
                  if (title.isEmpty) return;

                  setState(() => _saving = true);
                  try {
                    final scheduledAt = DateTime(
                      _selectedDate.year,
                      _selectedDate.month,
                      _selectedDate.day,
                      _selectedTime.hour,
                      _selectedTime.minute,
                    );

                    await FirebaseService().scheduleMeeting.call({
                      'title': title,
                      'description': _descCtrl.text.trim(),
                      'scheduledAt': scheduledAt.toIso8601String(),
                    });

                    if (context.mounted) Navigator.pop(context);
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed: $e')),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _saving = false);
                  }
                },
          child: Text(_saving ? 'Saving...' : 'Schedule'),
        ),
      ],
    );
  }
}
