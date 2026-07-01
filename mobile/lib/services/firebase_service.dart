import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart' as auth;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_functions/firebase_functions.dart';

class FirebaseService {
  static final FirebaseService _instance = FirebaseService._internal();
  factory FirebaseService() => _instance;
  FirebaseService._internal();

  late final FirebaseApp app;
  late final auth.FirebaseAuth authInstance;
  late final FirebaseFirestore firestore;
  late final FirebaseStorage storage;
  late final FirebaseFunctions functions;

  Future<void> initialize() async {
    app = await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
        appId: String.fromEnvironment('FIREBASE_APP_ID'),
        messagingSenderId: String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
        projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
        authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
        storageBucket: String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
      ),
    );
    authInstance = auth.FirebaseAuth.instanceFor(app: app);
    firestore = FirebaseFirestore.instanceFor(app: app);
    storage = FirebaseStorage.instanceFor(app: app);
    functions = FirebaseFunctions.instanceFor(app: app);
  }

  // Auth
  Stream<auth.User?> get authState => authInstance.authStateChanges();
  auth.User? get currentUser => authInstance.currentUser;

  Future<auth.UserCredential> signInWithGoogle() async {
    final provider = auth.GoogleAuthProvider();
    return authInstance.signInWithPopup(provider);
  }

  Future<void> signOut() => authInstance.signOut();

  // Firestore collections
  CollectionReference get meetings => firestore.collection('meetings');
  CollectionReference get recordings => firestore.collection('recordings');
  CollectionReference get users => firestore.collection('users');

  DocumentReference meetingDoc(String id) =>
      firestore.collection('meetings').doc(id);

  CollectionReference participants(String meetingId) =>
      firestore.collection('meetings').doc(meetingId).collection('participants');

  CollectionReference messages(String meetingId) =>
      firestore.collection('meetings').doc(meetingId).collection('messages');

  // Cloud Functions
  HttpsCallable get getLiveKitToken => functions.httpsCallable('getLiveKitToken');
  HttpsCallable get createInstantMeeting =>
      functions.httpsCallable('createInstantMeeting');
  HttpsCallable get endMeeting => functions.httpsCallable('endMeeting');
  HttpsCallable get scheduleMeeting => functions.httpsCallable('scheduleMeeting');

  // Storage
  Reference recordingRef(String meetingId, String fileName) =>
      storage.ref('recordings/$meetingId/$fileName');
}
