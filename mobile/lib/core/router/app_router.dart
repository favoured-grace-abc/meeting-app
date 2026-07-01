import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/meeting/screens/meeting_list_screen.dart';
import '../../features/meeting/screens/meeting_room_screen.dart';
import '../../features/recordings/screens/recordings_screen.dart';

final GlobalKey<NavigatorState> _rootNavigator = GlobalKey<NavigatorState>();

final appRouter = GoRouter(
  navigatorKey: _rootNavigator,
  initialLocation: '/login',
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/meetings',
      builder: (context, state) => const MeetingListScreen(),
    ),
    GoRoute(
      path: '/meeting/:meetingId',
      builder: (context, state) => MeetingRoomScreen(
        meetingId: state.pathParameters['meetingId']!,
      ),
    ),
    GoRoute(
      path: '/recordings',
      builder: (context, state) => const RecordingsScreen(),
    ),
  ],
);
