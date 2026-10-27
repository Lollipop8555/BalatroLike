import { createGame } from './game.js';
import { initUI } from './ui.js';

const game = createGame();
initUI(game);

// 便于调试与学术实验：控制台可用 window.game
window.game = game;
