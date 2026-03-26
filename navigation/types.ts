import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Dashboard: undefined;
  Visits: undefined;
  Clients: undefined;
  Charges: undefined;
  Chat: { contactId?: string } | undefined;
  Manager: NavigatorScreenParams<ManagerStackParamList> | undefined;
  Account: undefined;
};

export type ManagerStackParamList = {
  ManagerHome: undefined;
  Map: undefined;
  Vendors: undefined;
  VendorDetail: { vendorId: string };
  Alerts: undefined;
  AlertConfig: undefined;
  VisitSettings: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Login: undefined;
  TenantBootstrap: undefined;
};
