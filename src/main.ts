import { App } from './ui/app';
import { warmMotion } from './render/animation';
import { preloadArt } from './render/art';
import './remaster.css';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

root.innerHTML = '<div class="loading-screen"><span class="loading-mark">JB</span><p>Getting the crew ready…</p></div>';
void preloadArt().then(warmMotion).then(() => {
  const app = new App(root);
  app.go({ kind: 'title' });
});
