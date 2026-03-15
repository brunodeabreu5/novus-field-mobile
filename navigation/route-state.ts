import type { NavigationState, PartialState, Route } from "@react-navigation/native";

type StateLike = NavigationState | PartialState<NavigationState> | undefined;

function hasNestedState(
  route: Route<string> | (Partial<Route<string>> & { state?: StateLike })
): route is Route<string> & { state: StateLike } {
  return "state" in route && route.state != null;
}

export function getActiveRouteName(state: StateLike): string | undefined {
  if (!state || !state.routes?.length) {
    return undefined;
  }

  const index = state.index ?? state.routes.length - 1;
  const route = state.routes[index];

  if (hasNestedState(route)) {
    return getActiveRouteName(route.state) ?? route.name;
  }

  return route.name;
}
