import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NavigationProp } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import { useMenu } from "../contexts/MenuContext";
import { useAuth } from "../contexts/AuthContext";
import { getActiveRouteName } from "../navigation/route-state";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";

type DrawerItemName = keyof MainTabParamList;

type NavItem = {
  name: DrawerItemName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", label: "Inicio", icon: "home-outline" },
  { name: "Visits", label: "Visitas", icon: "list-outline" },
  { name: "Clients", label: "Clientes", icon: "people-outline" },
  { name: "Charges", label: "Cobros", icon: "wallet-outline" },
  { name: "Chat", label: "Chat", icon: "chatbubbles-outline" },
  { name: "Manager", label: "Manager", icon: "settings-outline" },
  { name: "Account", label: "Mi Cuenta", icon: "person-circle-outline" },
];

export default function DrawerMenu() {
  const { isOpen, closeMenu } = useMenu();
  const { user, profile, signOut, isManagerOrAdmin } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.85, 380);
  const slideAnim = React.useRef(new Animated.Value(-drawerWidth)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const animationRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const activeRouteName = getActiveRouteName(navigation.getState());

  useEffect(() => {
    animationRef.current?.stop();

    const animation = isOpen
      ? Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 14,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      : Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -drawerWidth,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]);

    animationRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
    };
  }, [backdropOpacity, drawerWidth, isOpen, slideAnim]);

  const handleNav = (screenName: DrawerItemName) => {
    closeMenu();
    navigation.navigate("Main", { screen: screenName });
  };

  const handleLogout = () => {
    closeMenu();
    signOut();
  };

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.name === "Manager" ? isManagerOrAdmin : true
  );

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={closeMenu}
    >
      <View style={styles.wrapper}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={isOpen ? "auto" : "none"}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.logoBox}>
                <Image
                  source={require("../assets/icon.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brand}>NovusField</Text>
              <Text style={styles.brandSub}>Gestion de equipos</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>
                  {profile?.role_title || (isManagerOrAdmin ? "Manager" : "Vendedor")}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Menu</Text>
            {filteredItems.map((item) => (
              <Pressable
                key={item.name}
                style={({ pressed }) => [
                  styles.navItem,
                  activeRouteName === item.name && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
                onPress={() => handleNav(item.name)}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={
                    activeRouteName === item.name ? colors.accent : colors.foreground
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeRouteName === item.name && styles.navLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    activeRouteName === item.name
                      ? colors.accent
                      : colors.mutedForeground
                  }
                />
              </Pressable>
            ))}

            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {profile?.full_name || user?.email || "Usuario"}
                </Text>
                <Text style={styles.profileRole} numberOfLines={1}>
                  {profile?.role_title || ""}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && styles.logoutBtnPressed,
              ]}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={colors.destructive}
              />
              <Text style={styles.logoutText}>Cerrar sesion</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = spacing;
const f = fontSize;
const r = radius;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: s["2xl"],
    paddingBottom: s.xl,
    paddingHorizontal: s.md,
  },
  header: {
    alignItems: "center",
    marginBottom: s.xl,
    paddingBottom: s.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoBox: {
    width: s["2xl"] + s.md,
    height: s["2xl"] + s.md,
    borderRadius: r.lg,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s.md,
  },
  logoImage: {
    width: s["2xl"],
    height: s["2xl"],
  },
  brand: {
    fontSize: f.xl,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 2,
  },
  brandSub: {
    fontSize: f.sm,
    color: colors.mutedForeground,
  },
  rolePill: {
    marginTop: s.xs,
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: r.full,
    backgroundColor: colors.primaryMuted,
  },
  rolePillText: {
    fontSize: f.xs,
    fontWeight: "600",
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: f.xs,
    fontWeight: "600",
    color: colors.mutedForeground,
    letterSpacing: 1,
    marginBottom: s.sm,
    paddingHorizontal: s.sm,
    textTransform: "uppercase",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: s.md,
    paddingVertical: s.md,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    marginBottom: 2,
  },
  navItemPressed: {
    transform: [{ scale: 0.97 }],
  },
  navItemActive: {
    backgroundColor: colors.primaryMuted,
  },
  navLabel: {
    flex: 1,
    fontSize: f.base,
    fontWeight: "500",
    color: colors.foreground,
  },
  navLabelActive: {
    color: colors.accent,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: s.md,
    marginTop: s.xl,
    marginBottom: s.md,
    paddingVertical: s.md,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    backgroundColor: colors.primaryMuted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: f.base,
    fontWeight: "700",
    color: "#fff",
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: f.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  profileRole: {
    fontSize: f.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s.sm,
    paddingVertical: s.md,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    marginTop: s.sm,
  },
  logoutBtnPressed: {
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  logoutText: {
    fontSize: f.base,
    fontWeight: "500",
    color: colors.destructive,
  },
});
