"use client";

import React from 'react';
import { StyleSheet, View, Text, Image, SafeAreaView, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// --- CONSTANTS ---
// These are our battlefield coordinates. Tweak them to change the animation's feel.
const HEADER_MAX_HEIGHT = 280;
const HEADER_MIN_HEIGHT = 90;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const AVATAR_MAX_SIZE = 120;
const AVATAR_MIN_SIZE = 44;

/**
 * ANTI-HALLUCINATION PROTOCOL: VibeContentRenderer
 * Instead of relying on a specific icon library which might have versioning issues
 * (fa5 vs fa6 etc.), we render a representation from text. It's a self-reliant
 * solution that adheres to the Architect's philosophy.
 */
const VibeContentRenderer = ({ name, size = 24 }: { name: string; size?: number }) => {
  const iconMap: { [key: string]: string } = {
    Message: '💬',
    Unmute: '🔇',
    Call: '📞',
    Video: '📹',
    Back: '‹',
    More: '…',
  };
  return <Text style={{ fontSize: size, color: '#fff' }}>{iconMap[name] || '?'}</Text>;
};

const ActionButton = ({ iconName, label }: { iconName: string; label: string }) => (
  <View style={styles.actionButton}>
    <VibeContentRenderer name={iconName} size={24} />
    <Text style={styles.actionButtonText}>{label}</Text>
  </View>
);

const ProfileScreen = () => {
  // The scrollY value is the heart of the entire animation. It's our single source of truth.
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // --- ANIMATED STYLES ---
  // Each 'useAnimatedStyle' is a rule set for how a component should react to the scroll.

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolate.CLAMP,
    );
    return {
      height,
    };
  });

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    const size = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      [AVATAR_MAX_SIZE, AVATAR_MIN_SIZE],
      Extrapolate.CLAMP,
    );
    const top = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      // Position it in the center of the expanded header, then move it up
      // to the center of the collapsed header.
      [HEADER_MAX_HEIGHT / 2 - AVATAR_MAX_SIZE / 2, (HEADER_MIN_HEIGHT - AVATAR_MIN_SIZE) / 2],
      Extrapolate.CLAMP,
    );
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      top,
    };
  });

  const nameContainerAnimatedStyle = useAnimatedStyle(() => {
    const top = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      // Start below the avatar, end up centered with the collapsed avatar
      [HEADER_MAX_HEIGHT / 2 + AVATAR_MAX_SIZE / 2, (HEADER_MIN_HEIGHT - 20) / 2],
      Extrapolate.CLAMP,
    );
    const translateX = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      // Start centered, end to the right of the collapsed avatar
      [0, AVATAR_MIN_SIZE / 2 + 35],
      Extrapolate.CLAMP,
    );
    return {
      top,
      transform: [{ translateX }],
    };
  });

  const nameTextAnimatedStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE / 2], // Animate font size faster
      [28, 18],
      Extrapolate.CLAMP,
    );
    return {
      fontSize,
    };
  });

  const onlineStatusAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE / 2], // Fade out as it moves
      [1, 0],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
    };
  });

  const actionsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE / 2],
      [1, 0],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE / 4],
      [0, 50],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const topBarIconsAnimatedStyle = useAnimatedStyle(() => {
    // These fade IN as we scroll down. The inverse of the action buttons.
    const opacity = interpolate(
      scrollY.value,
      [HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
      [0, 1],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* This is the actual content that pushes the scroll view */}
        <View style={styles.body}>
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Bio</Text>
            <Text style={styles.infoContent}>25 y.o, CS streamer, San Francisco</Text>
          </View>
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Username</Text>
            <Text style={styles.infoContent}>@ronald_copper</Text>
          </View>
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Notifications</Text>
            <Text style={styles.infoContent}>On</Text>
          </View>
          {/* Add more dummy content to ensure scrolling is possible */}
          <View style={[styles.infoSection, { height: 200, backgroundColor: '#333' }]}>
            <Text style={styles.infoTitle}>Recent Media</Text>
          </View>
          <View style={[styles.infoSection, { height: 300, backgroundColor: '#444' }]}>
            <Text style={styles.infoTitle}>Shared Groups</Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* --- HEADER --- */}
      {/* This View is positioned absolutely, floating above the ScrollView */}
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        {/* The background image could go here */}
      </Animated.View>

      {/* --- FLOATING HEADER CONTENT --- */}
      {/* These elements are also absolute and are animated independently */}
      <Animated.Image
        style={[styles.avatar, avatarAnimatedStyle]}
        source={{ uri: 'https://i.pravatar.cc/300?u=ronaldcopper' }}
      />

      <Animated.View style={[styles.nameContainer, nameContainerAnimatedStyle]}>
        <Animated.Text style={[styles.name, nameTextAnimatedStyle]}>Ronald Copper</Animated.Text>
        <Animated.Text style={[styles.onlineStatus, onlineStatusAnimatedStyle]}>online</Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.actions, actionsAnimatedStyle]}>
        <ActionButton iconName="Message" label="Message" />
        <ActionButton iconName="Unmute" label="Unmute" />
        <ActionButton iconName="Call" label="Call" />
        <ActionButton iconName="Video" label="Video" />
      </Animated.View>

      {/* --- COLLAPSED HEADER ICONS --- */}
      <Animated.View style={[styles.topBar, topBarIconsAnimatedStyle]}>
        <View style={styles.topBarButton}>
          <VibeContentRenderer name="Back" size={34} />
        </View>
        <View style={styles.topBarButton}>
          <VibeContentRenderer name="More" size={30} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e', // Dark background for contrast
  },
  scrollContentContainer: {
    paddingTop: HEADER_MAX_HEIGHT,
    paddingBottom: 50,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4a2c82',
    overflow: 'hidden',
  },
  avatar: {
    position: 'absolute',
    left: width / 2 - AVATAR_MAX_SIZE / 2, // Start centered
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameContainer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
  },
  name: {
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineStatus: {
    fontSize: 16,
    color: '#d1c4e9',
  },
  actions: {
    position: 'absolute',
    bottom: 0, // This is relative to the header initially, but we translate it
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 20,
    top: HEADER_MAX_HEIGHT - 80,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  body: {
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#2c2c2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoTitle: {
    color: '#e0e0e0',
    fontSize: 14,
    marginBottom: 4,
  },
  infoContent: {
    color: '#fff',
    fontSize: 16,
  },
  topBar: {
    position: 'absolute',
    top: 45, // SafeAreaView offset
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: HEADER_MIN_HEIGHT - 45,
    alignItems: 'center',
  },
  topBarButton: {
    // For hit-box
  },
});

export default ProfileScreen;