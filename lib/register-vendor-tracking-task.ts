/**
 * Side-effect no entrypoint: registra o handler do expo-task-manager antes de qualquer
 * árvore condicional (ex.: bootstrap de tenant), para relançamentos do processo em background.
 */
import "./vendor-tracking-task";
