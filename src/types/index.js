// ============================================================
// Shared type definitions for the meeting platform
// ============================================================

/**
 * @typedef {'scheduled' | 'active' | 'ended'} MeetingStatus
 */

/**
 * @typedef {'host' | 'participant'} ParticipantRole
 */

/**
 * @typedef {'processing' | 'ready' | 'failed'} RecordingStatus
 */

/**
 * @typedef {'text' | 'system'} MessageType
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} displayName
 * @property {string} email
 * @property {string|null} photoURL
 * @property {Date} createdAt
 * @property {Date} lastSeen
 * @property {{ theme: string, notifications: boolean }} preferences
 */

/**
 * @typedef {Object} Meeting
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} hostId
 * @property {Date|null} scheduledAt
 * @property {Date|null} startedAt
 * @property {Date|null} endedAt
 * @property {MeetingStatus} status
 * @property {string} roomName
 * @property {boolean} recordingEnabled
 * @property {number} maxParticipants
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} Participant
 * @property {string} id
 * @property {string} displayName
 * @property {string} email
 * @property {string|null} photoURL
 * @property {Date} joinedAt
 * @property {Date|null} leftAt
 * @property {ParticipantRole} role
 * @property {boolean} isMuted
 * @property {boolean} isVideoOn
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} senderId
 * @property {string} senderName
 * @property {string} content
 * @property {Date} timestamp
 * @property {MessageType} type
 */

/**
 * @typedef {Object} Recording
 * @property {string} id
 * @property {string} meetingId
 * @property {string} hostId
 * @property {string} title
 * @property {string} url
 * @property {string|null} transcriptUrl
 * @property {number} duration
 * @property {number} fileSize
 * @property {RecordingStatus} status
 * @property {string|null} aiSummary
 * @property {string|null} aiTranscription
 * @property {Array<{id: string, name: string}>} speakers
 * @property {Date} createdAt
 * @property {string} meetingTitle
 */

/**
 * @typedef {Object} LiveKitToken
 * @property {string} token
 * @property {string} roomName
 * @property {string} serverUrl
 */

export const MeetingStatus = Object.freeze({
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  ENDED: 'ended',
});

export const ParticipantRole = Object.freeze({
  HOST: 'host',
  PARTICIPANT: 'participant',
});

export const RecordingStatus = Object.freeze({
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
});

export const MessageType = Object.freeze({
  TEXT: 'text',
  SYSTEM: 'system',
});
