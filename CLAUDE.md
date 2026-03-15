# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Novus Field Mobile is a React Native app built with Expo for field sales management. It provides visit tracking, client management, collections, chat, and real-time vendor tracking for sales teams. The app uses Supabase for authentication, database, and real-time features.

## Development Commands

### Running the App
```bash
npm start          # Start Expo dev server
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS (requires Mac)
npm run web        # Run in web browser
```

### Setup
```bash
npm install        # Install dependencies
cp .env.example .env  # Create environment file
```

### Environment Configuration
Required in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key

Optional (for push notifications):
- `EXPO_PUBLIC_PROJECT_ID` - Expo project ID

## Architecture

### Provider Stack
The app uses a nested provider hierarchy in `App.tsx`:
1. `QueryClientProvider` - TanStack Query for data fetching
2. `SafeAreaProvider` - React Native safe areas
3. `AuthProvider` - Authentication and user session state
4. `TrackingProvider` - Location tracking and geofence for vendors
5. `RootNavigator` - Navigation container

### Authentication Flow
- `AuthContext` (in `contexts/AuthContext.tsx`) manages Supabase auth state, user profiles, and roles
- Three user roles: `admin`, `manager`, `vendor`
- Auth state persists via AsyncStorage with automatic token refresh
- Profile completion check prompts users to fill `full_name`, `phone`, `role_title`
- Role-based UI: manager/admin see additional "Manager" tab
- Stale auth token cleanup on init errors

### Navigation Structure
- Root: Auth check → Login or Main Tabs
- Bottom Tabs: Dashboard, Visits, Clients, Charges, Chat, (Manager if admin/manager), Account
- Manager Stack (nested): ManagerHome → Map, Vendors, Alerts

### Directory Structure
```
mobile/
├── App.tsx              # Entry with providers
├── index.ts             # Expo entry point
├── lib/                 # Core utilities
│   ├── supabase.ts      # Supabase client
│   ├── config.ts        # App config
│   ├── types.ts         # Auto-generated DB types
│   ├── ids.ts           # ID generation
│   ├── geofence.ts      # Geofence calculations
│   ├── offline-storage.ts # Offline queue
│   └── dashboard.ts     # Dashboard helpers
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Authentication state
├── hooks/               # Custom hooks
│   ├── use-push-notifications.ts
│   ├── use-vendor-tracking.ts
│   └── use-geofence.ts
├── providers/           # App providers
│   └── TrackingProvider.tsx
├── navigation/          # Navigation setup
│   └── RootNavigator.tsx
├── screens/             # Screen components
├── theme/               # Styling
│   └── colors.ts
└── .env.example
```

### Key Hooks

**`usePushNotifications`** (`hooks/use-push-notifications.ts`)
- Registers Expo push tokens to `mobile_push_tokens` table
- Requires `EXPO_PUBLIC_PROJECT_ID` in environment for token registration
- Token upserted with `user_id, token, platform, provider` conflict constraint
- Returns `{ expoPushToken, permission, isLoading, subscribe }`

**`useVendorTracking`** (`hooks/use-vendor-tracking.ts`)
- For vendors only: polls location every 10 seconds
- Records positions to `vendor_positions` table when displacement ≥10m
- Calculates speed (km/h) from m/s, heading, accuracy
- Includes internal `haversine()` distance calculation

**`useGeofence`** (`hooks/use-geofence.ts`)
- Auto check-in/out when entering/exiting client zones
- Fetches enabled zones from `geofence_alert_configs` + client coordinates from `clients`
- Adaptive radius based on GPS accuracy (hysteresis for enter vs exit)
- Enqueues check-in/out events to offline storage
- Returns `{ activeVisits, currentPosition, error, manualCheckOut }`

### Database Schema Patterns

**Key Tables:**
- `profiles` - User profiles (id, full_name, phone, role_title, avatar_url, document)
- `user_roles` - Role assignments (admin, manager, vendor)
- `clients` - Client records with latitude/longitude
- `visits` - Check-in/check-out records with location and photos
- `charges` - Payment collections
- `chat_messages` - User-to-user messaging
- `vendor_positions` - Real-time vendor locations for manager map
- `geofence_alert_configs` - Zone rules with custom radii and schedules
- `geofence_alerts` - Triggered alerts when vendors cross boundaries
- `manager_notifications` - Alert feed for managers

**TypeScript Types:** Auto-generated in `lib/types.ts` from Supabase schema. Use:
- `TablesInsert<'tablename'>` for insert types
- `TablesUpdate<'tablename'>` for update types
- `Enums<'enum_name'>` for enum types
- Access via `Database.public.Tables.tablename.Row` for row types

### Location & Geofencing

**Geofence Logic** (`lib/geofence.ts`):
- `haversineDistance(a, b)` - Distance calculation between coordinates
- `getAdaptiveRadius(zone, accuracy, mode)` - Adaptive radius with accuracy compensation
  - Base radius + (accuracy × 0.5), clamped to min/max
  - Exit radius 20% larger than enter radius (hysteresis)
- `getAlertSeverity(distance, radius, type)` - Severity based on distance ratio

**Auto Check-in:**
- Enabled via `TrackingProvider` with `autoCheckIn: true`
- Queues events to offline storage for sync
- Manual check-out available via `manualCheckOut(zoneId)`

### Role-Based Features

**Vendors:**
- Visit tracking (auto and manual)
- Client management
- Charge recording
- Chat with other users
- Location tracking when logged in
- Geofence auto check-in/out

**Managers/Admins:**
- All vendor features plus:
- Real-time vendor map (`vendor_positions`)
- Alert history from geofence events
- Vendor list management

### TanStack Query Usage
Screens typically use:
- `useQuery()` for fetching data with `supabase.from(...).select()`
- `useMutation()` for writes with invalidation
- Query keys follow pattern: `['resource', id]`

### Theme
Colors defined in `theme/colors.ts` following a semantic naming convention:
- `primary`, `primaryForeground`
- `background`, `foreground`
- `muted`, `mutedForeground`
- `success`, `successMuted`, `warning`, `warningMuted`
- `destructive`, `info`, `infoMuted`
- `border`, `card`, `cardForeground`

### Offline Support
Offline storage queue in `lib/offline-storage.ts`:
- `offlineStorage.enqueue({ type, payload })` - Add action to queue
- `offlineStorage.getQueue()` - Retrieve queued actions
- `offlineStorage.removeFromQueue(id)` - Remove processed action
- `offlineStorage.clearQueue()` - Clear all actions
- Action types: `check_in`, `check_out`, `visit_create`
- Persists to AsyncStorage under `novus_sync_queue` key
- Sync implementation pending

## Code Patterns

### Supabase Queries
```typescript
import { supabase } from './lib/supabase';
import type { TablesInsert } from './lib/types';

// Fetch with TypeScript types
const { data, error } = await supabase
  .from("visits")
  .select("*")
  .eq("vendor_id", userId)
  .order("created_at", { ascending: false });

// Insert with generated ID
const { error } = await supabase
  .from("visits")
  .insert({
    id: generateId(),
    vendor_id: userId,
    check_in_at: new Date().toISOString(),
  } as TablesInsert<'visits'>);
```

### Geolocation Permissions
Always check permissions before location operations:
```typescript
import * as Location from 'expo-location';

const { status } = await Location.getForegroundPermissionsAsync();
if (status !== "granted") {
  // Handle permission denied
}
```

### Session Management
Use `useAuth()` hook from `contexts/AuthContext.tsx`:
- `session`, `user`, `profile`, `role` - Current auth state
- `loading` - Auth initialization status
- `profileIncomplete` - Whether profile needs completion
- `isAdmin`, `isManager`, `isVendor`, `isManagerOrAdmin` - Role checks
- `signIn()`, `signUp()`, `signOut()` - Auth operations
- `updateProfile()` - Profile updates
- `dismissProfilePrompt()` - Dismiss profile completion prompt

### ID Generation
Use `generateId()` from `lib/ids.ts` for new records (UUID v4 format):
```typescript
import { generateId } from './lib/ids';

const newId = generateId(); // Returns UUID string
```
