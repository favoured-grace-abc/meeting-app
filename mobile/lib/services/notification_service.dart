import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    await _requestPermission();

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _localNotifications.initialize(
      const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    await _setupTokenRefresh();
    await _setupForegroundHandler();
    await _setupBackgroundHandler();
  }

  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: true,
      carPlay: true,
    );

    if (kDebugMode) {
      print('Notification permission: ${settings.authorizationStatus}');
    }
  }

  Future<String?> getToken() => _messaging.getToken();

  Future<void> _setupTokenRefresh() async {
    _messaging.onTokenRefresh.listen((token) {
      if (kDebugMode) print('FCM token refreshed: $token');
    });
  }

  void _setupForegroundHandler() {
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
  }

  Future<void> _setupBackgroundHandler() async {
    FirebaseMessaging.onBackgroundAppLaunchEnabled();
    FirebaseMessaging.onBackgroundMessage(_backgroundHandler);

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationData(initialMessage.data);
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final androidDetails = AndroidNotificationDetails(
      'meetflow_channel',
      'MeetFlow Notifications',
      channelDescription: 'Meeting invitations and updates',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _handleNotificationTap(NotificationResponse response) {
    if (response.payload != null) {
      final data = jsonDecode(response.payload!) as Map<String, dynamic>;
      _handleNotificationData(data);
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    if (response.payload != null) {
      final data = jsonDecode(response.payload!) as Map<String, dynamic>;
      _handleNotificationData(data);
    }
  }

  static Future<void> _backgroundHandler(RemoteMessage message) async {
    if (kDebugMode) {
      print('Background message: ${message.messageId}');
    }
  }

  void _handleNotificationData(Map<String, dynamic> data) {
    final meetingId = data['meetingId'] as String?;
    if (meetingId != null) {
      // Navigate to meeting room
    }
  }

  Future<void> subscribeToMeeting(String meetingId) async {
    await _messaging.subscribeToTopic('meeting_$meetingId');
  }

  Future<void> unsubscribeFromMeeting(String meetingId) async {
    await _messaging.unsubscribeFromTopic('meeting_$meetingId');
  }
}
