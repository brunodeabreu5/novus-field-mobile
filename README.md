# Novus Field - Mobile (React Native / Expo)

App móvel nativo para Novus Field, sem WebView. Gestão de visitas, clientes, cobranças, chat y tracking de vendedores.

## Requisitos

- Node.js 18+
- Expo Go (para desarrollo) o EAS Build (para producción)

## Configuración

1. Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Editar `.env` con las credenciales de Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

3. Instalar dependencias (ya hecho si usó `npx create-expo-app`):

```bash
npm install
```

## Ejecutar

```bash
# Iniciar Expo
npm start

# Android
npm run android

# iOS (requiere Mac)
npm run ios
```

## Estructura

```
mobile/
├── App.tsx              # Entry con providers
├── lib/                 # Supabase, config, tipos, geofence
├── contexts/            # AuthContext
├── hooks/               # use-push-notifications, use-vendor-tracking
├── navigation/          # RootNavigator, tabs, stack
├── screens/             # Login, Dashboard, Visits, Clients, etc.
├── theme/               # colors
└── .env.example
```

## Funcionalidades

- **Auth**: Login, signup, perfil con Supabase
- **Dashboard**: KPIs y visitas recientes
- **Visitas**: Lista, crear visita, filtro por período
- **Clientes**: CRUD básico
- **Cobros**: Lista y crear cobros
- **Chat**: Mensajes entre usuarios
- **Cuenta**: Editar perfil, cerrar sesión
- **Manager** (admin/manager): Mapa de vendedores, lista vendedores, alertas

## Push Notifications

El hook `usePushNotifications` registra el token Expo en `mobile_push_tokens`. Requiere configuración de EAS y proyecto Expo para envío de push.

## Geolocalización

`useVendorTracking` envía posiciones a `vendor_positions` para el mapa de manager. Solicite permiso de ubicación al iniciar.
