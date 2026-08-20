import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { useTutorChat } from '@/hooks/useTutorChat';
import type { ChatMessage, TutorChatContext } from '@/types/chat';

const MAX_QUESTION_LENGTH = 300;

/** Openers for the empty state — the blank box is the hardest part of a chat. */
const STARTERS = [
  '제 번역은 왜 어색한가요?',
  '추천 문장이랑 제 문장, 뭐가 다른가요?',
  '이 표현은 언제 쓰면 좋을까요?',
];

interface TutorChatModalProps {
  visible: boolean;
  /** The evaluation being asked about. */
  context: TutorChatContext;
  onClose: () => void;
}

/**
 * A messenger-style sheet for asking follow-up questions about an evaluation.
 *
 * Keep it mounted alongside the screen rather than mounting it on open: the
 * conversation lives in this component's hook, so unmounting would throw the
 * thread away every time the sheet is dismissed.
 */
export function TutorChatModal({ visible, context, onClose }: TutorChatModalProps) {
  const chat = useTutorChat(visible ? context : null);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // While the keyboard is up it covers the navigation bar, so paying the inset
  // as well would float the composer a finger's width above the keyboard
  // instead of sitting on it.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const canSend = draft.trim().length > 0 && !chat.isSending;

  // New messages (and the typing indicator) should never appear below the fold.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [chat.messages.length, chat.isSending, visible]);

  const handleSend = () => {
    if (!canSend) return;
    const question = draft;
    setDraft('');
    void chat.send(question);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      // Lets the sheet reach the bottom edge on Android rather than stopping
      // above the navigation bar; the element below pays the inset back.
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.scrim}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Only the strip above the sheet dismisses; the sheet itself does not. */}
        <Pressable style={styles.backdrop} accessibilityLabel="닫기" onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>AI 선생님</Text>
              <Text style={styles.title}>질문하기</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor={Colors.textSecondary}
              />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>이 평가에 대해 물어보고 있어요</Text>
              <Text style={styles.contextKorean} numberOfLines={2}>
                {context.koreanText}
              </Text>
              <Text style={styles.contextEnglish} numberOfLines={2}>
                {context.englishInput}
              </Text>
            </View>

            {chat.messages.length === 0 && !chat.isSending && (
              <View style={styles.starters}>
                <Text style={styles.startersLabel}>이렇게 물어볼 수 있어요</Text>
                {STARTERS.map((starter) => (
                  <Pressable
                    key={starter}
                    accessibilityRole="button"
                    onPress={() => void chat.send(starter)}
                    style={({ pressed }) => [styles.starter, pressed && styles.pressed]}
                  >
                    <Text style={styles.starterLabel}>{starter}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {chat.messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}

            {chat.isSending && (
              <View style={[styles.bubble, styles.tutorBubble, styles.typing]}>
                <ActivityIndicator size="small" color={Colors.primaryLight} />
                <Text style={styles.typingLabel}>선생님이 답을 쓰고 있어요...</Text>
              </View>
            )}
          </ScrollView>

          {chat.error && (
            <View style={styles.errorBar}>
              <Text style={styles.errorText} numberOfLines={2}>
                {chat.error}
              </Text>
              {chat.canRetry && !chat.isSending && (
                <Pressable
                  accessibilityRole="button"
                  onPress={chat.retry}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.retryLabel}>다시 시도</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* The composer is the bottom-most element, so it owns the inset:
              without it the field sits under the home indicator or the Android
              navigation bar. */}
          <View
            style={[
              styles.composer,
              { paddingBottom: Spacing.md + (keyboardVisible ? 0 : insets.bottom) },
            ]}
          >
            <TextInput
              accessibilityLabel="질문 입력"
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="궁금한 점을 물어보세요"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={MAX_QUESTION_LENGTH}
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={handleSend}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="질문 보내기"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={handleSend}
              style={({ pressed }) => [
                styles.send,
                !canSend && styles.sendDisabled,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                size={18}
                tintColor={Colors.textPrimary}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowTutor]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.tutorBubble,
          message.failed && styles.failedBubble,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.text}</Text>
      </View>
      {message.failed && <Text style={styles.failedLabel}>전송 실패</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    // Fixed rather than max: the thread should not resize as answers arrive.
    height: '88%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.textPrimary,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pressed: {
    opacity: 0.6,
  },

  thread: {
    flex: 1,
  },
  threadContent: {
    padding: Spacing.base,
    gap: Spacing.md,
  },

  contextCard: {
    gap: 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contextLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  contextKorean: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  contextEnglish: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  starters: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  startersLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  starter: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  starterLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
  },

  row: {
    gap: 2,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowTutor: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.sm,
  },
  tutorBubble: {
    backgroundColor: Colors.surfaceLight,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  failedBubble: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  bubbleText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    color: Colors.textPrimary,
  },
  userBubbleText: {
    color: Colors.textPrimary,
  },
  failedLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.error,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
  },
  typingLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: `${Colors.error}22`,
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.error,
  },
  retryLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.4,
    color: Colors.textPrimary,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  sendDisabled: {
    backgroundColor: Colors.surfaceElevated,
  },
});
