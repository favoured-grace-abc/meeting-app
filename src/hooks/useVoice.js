import { useState, useRef, useCallback, useEffect } from 'react';
import { speechToTextWithDiarization, textToSpeech, processTranscript } from '../services/voice';

const CHUNK_INTERVAL = 5000;

export function useVoice(participants = []) {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [currentCaption, setCurrentCaption] = useState(null);
  const [captionsHistory, setCaptionsHistory] = useState([]);
  const [sttError, setSttError] = useState(null);
  const [speakerMap, setSpeakerMap] = useState({});

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const speakerMapRef = useRef({});
  const nextSpeakerIdx = useRef(0);

  const resolveSpeaker = useCallback((speakerLabel) => {
    if (!speakerLabel) return null;
    if (speakerMapRef.current[speakerLabel]) {
      return speakerMapRef.current[speakerLabel];
    }
    const idx = nextSpeakerIdx.current;
    nextSpeakerIdx.current += 1;
    const name =
      participants[idx]?.name ||
      participants[idx]?.identity ||
      `Speaker ${idx + 1}`;
    const color = COLORS[idx % COLORS.length];
    speakerMapRef.current[speakerLabel] = { name, color };
    setSpeakerMap({ ...speakerMapRef.current });
    return { name, color };
  }, [participants]);

  const processChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    try {
      const result = await speechToTextWithDiarization(blob);
      if (result.segments && result.segments.length > 0) {
        for (const seg of result.segments) {
          if (!seg.text) continue;
          const speaker = resolveSpeaker(seg.speaker);
          const entry = {
            id: Date.now() + Math.random(),
            text: seg.text,
            speaker: speaker || { name: 'Unknown', color: '#888' },
            timestamp: Date.now(),
          };
          setCurrentCaption(entry);
          setCaptionsHistory((prev) => [...prev.slice(-49), entry]);
        }
      } else if (result.text && result.text.trim()) {
        const entry = {
          id: Date.now(),
          text: result.text,
          speaker: { name: 'Speaker', color: COLORS[0] },
          timestamp: Date.now(),
        };
        setCurrentCaption(entry);
        setCaptionsHistory((prev) => [...prev.slice(-49), entry]);
      }
      setSttError(null);
    } catch (err) {
      console.error('STT chunk error:', err);
      setSttError(err.message);
    }
  }, [resolveSpeaker]);

  const startCaptions = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setSttError(null);
      setCurrentCaption(null);
      setCaptionsHistory([]);
      speakerMapRef.current = {};
      nextSpeakerIdx.current = 0;
      setSpeakerMap({});
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000);
      intervalRef.current = setInterval(processChunk, CHUNK_INTERVAL);
      setCaptionsEnabled(true);
    } catch (err) {
      console.error('Failed to start captions:', err);
      setSttError(err.message || 'Microphone access denied');
    }
  }, [processChunk]);

  const stopCaptions = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    setCaptionsEnabled(false);
    setCurrentCaption(null);
    setSttError(null);
  }, []);

  const toggleCaptions = useCallback(() => {
    if (captionsEnabled) {
      stopCaptions();
    } else {
      startCaptions();
    }
  }, [captionsEnabled, startCaptions, stopCaptions]);

  const getTranscript = useCallback(() => {
    return captionsHistory.map((c) => `[${c.speaker.name}] ${c.text}`).join('\n');
  }, [captionsHistory]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    captionsEnabled,
    currentCaption,
    captionsHistory,
    sttError,
    speakerMap,
    toggleCaptions,
    startCaptions,
    stopCaptions,
    getTranscript,
  };
}

const COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];

export function useTTS() {
  const [playing, setPlaying] = useState(null);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const speak = useCallback(async (text, id) => {
    try {
      setError(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(id);
      const blob = await textToSpeech(text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlaying(null);
        setError('Audio playback failed');
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setError(err.message);
      setPlaying(null);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(null);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { speak, stop, playing, error };
}

export function useLLM() {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const summarize = useCallback(async (transcript, customPrompt) => {
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const data = await processTranscript(transcript, customPrompt);
      setResult(data.output);
      return data.output;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { summarize, clear, processing, result, error };
}
