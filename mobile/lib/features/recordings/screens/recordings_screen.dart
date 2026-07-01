import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../../../services/firebase_service.dart';

class RecordingsScreen extends StatelessWidget {
  const RecordingsScreen({super.key});

  String _formatDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins}:${secs.toString().padLeft(2, '0')}';
  }

  String _formatDate(Timestamp? ts) {
    if (ts == null) return '';
    final date = ts.toDate();
    return DateFormat('MMM d, yyyy · h:mm a').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final userId = FirebaseService().currentUser?.uid;

    return Scaffold(
      appBar: AppBar(title: const Text('Recordings')),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseService()
            .recordings
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

          final recordings = snapshot.data?.docs ?? [];

          if (recordings.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.mic_off, size: 64,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                  const SizedBox(height: 16),
                  Text('No recordings yet',
                      style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: recordings.length,
            itemBuilder: (context, index) {
              final data = recordings[index].data() as Map<String, dynamic>;
              final status = data['status'] as String? ?? 'ready';
              final isProcessing = status == 'processing';
              final isFailed = status == 'failed';

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ExpansionTile(
                  initiallyExpanded: false,
                  leading: Icon(
                    isProcessing
                        ? Icons.hourglass_bottom
                        : isFailed
                            ? Icons.error
                            : Icons.check_circle,
                    color: isProcessing
                        ? Colors.amber
                        : isFailed
                            ? Colors.red
                            : Colors.green,
                  ),
                  title: Text(
                    data['title'] as String? ?? 'Untitled Recording',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  subtitle: Text(
                    _formatDate(data['createdAt'] as Timestamp?),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  children: [
                    if (isProcessing)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 12),
                            Text('AI processing...'),
                          ],
                        ),
                      )
                    else ...[
                      if (data['duration'] != null)
                        _DetailRow(
                          label: 'Duration',
                          value: _formatDuration(data['duration'] as int),
                        ),
                      if (data['fileSize'] != null)
                        _DetailRow(
                          label: 'Size',
                          value:
                              '${((data['fileSize'] as int) / (1024 * 1024)).toStringAsFixed(1)} MB',
                        ),
                      if (data['aiSummary'] != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('AI Summary',
                                  style: Theme.of(context).textTheme.labelLarge),
                              const SizedBox(height: 4),
                              Text(
                                data['aiSummary'] as String,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                    ],
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(value, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}
