import { useState, useRef, useCallback, useEffect } from 'react';
import { speechToText, textToSpeech, processTranscript } from '../services/voice';

const CHUNK_INTERVAL = 4000;

export function useVoice() {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [caption, setCaption] = useState('');
  const [captionsHistory, setCaptionsHistory] = useState([]);
  const [sttError, setSttError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);

  const processChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    try {
      const text = await speechToText(blob);
      if (text.trim()) {
        setCaption(text);
        setCaptionsHistory((prev) => [...prev.slice(-49), text]);
      }
      setSttError(null);
    } catch (err) {
      console.error('STT chunk error:', err);
      setSttError(err.message);
    }
  }, []);

  const startCaptions = useCallback(async () => {
    try {
      setSttError(null);
      setCaption('');
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
    setCaption('');
    setSttError(null);
  }, []);

  const toggleCaptions = useCallback(() => {
    if (captionsEnabled) {
      stopCaptions();
    } else {
      startCaptions();
    }
  }, [captionsEnabled, startCaptions, stopCaptions]);

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
    caption,
    captionsHistory,
    sttError,
    toggleCaptions,
    startCaptions,
    stopCaptions,
  };
}

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
