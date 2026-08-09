import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';

import { useTranscription } from '@/hooks/useTranscription';
import { useRecordingStore } from '@/stores/useRecordingStore';
import { deleteAudioFile, formatDuration } from '@/utils/audioHelpers';

export function VoiceRecorder() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);

  const isRecording = useRecordingStore((s) => s.isRecording);
  const audioUri = useRecordingStore((s) => s.audioUri);
  const storedDuration = useRecordingStore((s) => s.duration);
  const startRecording = useRecordingStore((s) => s.startRecording);
  const stopRecording = useRecordingStore((s) => s.stopRecording);
  const resetRecording = useRecordingStore((s) => s.resetRecording);

  const transcription = useTranscription();
  const [error, setError] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsing red halo behind the mic while a take is in progress.
  useEffect(() => {
    if (!isRecording) {
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.35,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  const elapsedSeconds = isRecording
    ? Math.floor(recorderState.durationMillis / 1000)
    : storedDuration;

  const handleStartRecording = async () => {
    setError(null);

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone access is required to record. Please enable it in your device settings.');
      return;
    }

    // iOS needs the session switched to record mode before the recorder starts.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();

    audioRecorder.record();
    startRecording();
  };

  const handleStopRecording = async () => {
    const duration = Math.round(recorderState.durationMillis / 1000);
    await audioRecorder.stop();

    const uri = audioRecorder.uri;
    if (!uri) {
      resetRecording();
      setError('Recording failed — no audio was captured. Please try again.');
      return;
    }

    stopRecording(uri, duration);
    transcription.mutate(uri);
  };

  const handleToggle = async () => {
    try {
      if (isRecording) {
        await handleStopRecording();
      } else {
        await handleStartRecording();
      }
    } catch (err) {
      resetRecording();
      setError(err instanceof Error ? err.message : 'Something went wrong while recording.');
    }
  };

  const handleReRecord = async () => {
    setError(null);
    transcription.reset();

    if (audioUri) {
      // Recordings live in the cache directory; drop the old take so they don't pile up.
      await deleteAudioFile(audioUri).catch(() => {});
    }

    resetRecording();
  };

  const isProcessing = transcription.isPending;
  const isDone = transcription.isSuccess && !!audioUri;

  return (
    <View className="items-center gap-4 py-6">
      <View className="h-32 w-32 items-center justify-center">
        {isRecording && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              height: 128,
              width: 128,
              borderRadius: 64,
              backgroundColor: 'rgba(239, 68, 68, 0.25)',
              transform: [{ scale: pulse }],
            }}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          accessibilityState={{ busy: isProcessing }}
          disabled={isProcessing}
          onPress={handleToggle}
          className={`h-24 w-24 items-center justify-center rounded-full ${
            isRecording ? 'bg-red-500' : isProcessing ? 'bg-surface-light' : 'bg-primary-600'
          } ${isProcessing ? 'opacity-60' : ''}`}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <SymbolView
              name={{
                ios: isRecording ? 'stop.fill' : 'mic.fill',
                android: isRecording ? 'stop' : 'mic',
                web: isRecording ? 'stop' : 'mic',
              }}
              size={36}
              tintColor="#FFFFFF"
            />
          )}
        </Pressable>
      </View>

      <Text className="font-mono text-lg text-white">{formatDuration(elapsedSeconds)}</Text>

      {isRecording && <Text className="text-sm text-red-400">Recording…</Text>}
      {isProcessing && <Text className="text-sm text-primary-100">Transcribing…</Text>}

      {isDone && (
        <View className="w-full items-center gap-1 px-4">
          <View className="flex-row items-center gap-2">
            <SymbolView
              name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
              size={18}
              tintColor="#4ADE80"
            />
            <Text className="text-sm text-green-400">Transcribed</Text>
          </View>
          <Text className="text-center text-sm text-zinc-300" numberOfLines={3}>
            {transcription.data}
          </Text>
        </View>
      )}

      {transcription.isError && (
        <Text className="px-4 text-center text-sm text-red-400">
          {transcription.error instanceof Error
            ? transcription.error.message
            : 'Transcription failed. Please try again.'}
        </Text>
      )}

      {error && <Text className="px-4 text-center text-sm text-red-400">{error}</Text>}

      {audioUri && !isRecording && !isProcessing && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Record again"
          onPress={handleReRecord}
          className="rounded-full border border-white/15 px-4 py-2"
        >
          <Text className="text-sm text-zinc-300">Record again</Text>
        </Pressable>
      )}
    </View>
  );
}
