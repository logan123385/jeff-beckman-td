import { App } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const app = new App(root);
app.go({ kind: 'title' });
