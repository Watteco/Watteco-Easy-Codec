/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module 'ionicons/icons';

declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
	export default component;
}
