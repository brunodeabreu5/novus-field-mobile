# Novus Field - Mobile (React Native / Expo)

App móvel nativo para Novus Field, sem WebView. Gestão de visitas, clientes, cobranças, chat e tracking de vendedores.

## Requisitos

- Node.js 18+
- Expo Go o Development Build para desenvolvimento
- EAS Build para distribuição interna/produção

## Configuración

1. Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Editar `.env` com a URL do backend:

```
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_WS_URL=http://localhost:4000
# Opcional: só defina se você tiver um UUID real do projeto Expo/EAS para push
# EXPO_PUBLIC_PROJECT_ID=
```

3. Instalar dependências:

```bash
npm install
```

## Executar

```bash
# Iniciar Expo
npm start

# Android via prebuild/dev client
npm run android

# iOS (requer Mac)
npm run ios
```

Observações:

- O repositório não versiona a pasta nativa `android/`. O fluxo Android depende de `expo run:android`/prebuild local ou EAS Build.
- O token Expo para push tenta resolver o `projectId` a partir do metadata do EAS primeiro. O `.env` é apenas fallback.
- Para validar mudanças críticas, prefira device físico quando o fluxo envolver permissões, background location ou push notifications.

## Estrutura

```
novus-field-mobile/
├── App.tsx              # Entry con providers
├── lib/                 # API, config, tipos, geofence
├── contexts/            # AuthContext
├── hooks/               # use-push-notifications, use-vendor-tracking
├── navigation/          # RootNavigator, tabs, stack
├── screens/             # Login, Dashboard, Visits, Clients, etc.
├── theme/               # colors
└── .env.example
```

## Funcionalidades

- **Auth**: Login, signup e perfil via backend NestJS
- **Dashboard**: KPIs y visitas recientes
- **Visitas**: Lista, criar visita, filtro por período
- **Clientes**: CRUD básico
- **Cobros**: Lista e criação de cobranças
- **Chat**: Mensajes entre usuarios
- **Conta**: Editar perfil, biometria e encerramento de sessão
- **Manager** (admin/manager): Mapa de vendedores, lista vendedores, alertas

## Push Notifications

O hook de permissões registra o token Expo no backend. Sem `projectId` válido, o app degrada silenciosamente e não tenta registrar push. Para envio real, use metadata do EAS ou um UUID real de projeto Expo/EAS.

## Geolocalização

`useVendorTracking` envia posições ao backend para o mapa do manager. O app suporta `foreground_only` e `background`, dependendo da permissão real concedida.

## Validação recomendada

Antes de publicar ou distribuir build interna, rode:

```bash
npm run check
```

Smoke test manual mínimo:

1. Login com sessão válida.
2. Login com sessão expirada/salva anteriormente.
3. Tracking com app aberto.
4. Tracking em background após conceder permissão.
5. Chat e presença online.
6. Push com build sem `projectId` configurado.
7. Push com build EAS configurado.
