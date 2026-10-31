// Violentmonkey's GM_* API as the userscript uses it (see @grant in src/header.js), for tools/typecheck.sh.
declare function GM_getValue(key: string, fallback?: any): any;
declare function GM_setValue(key: string, value: any): void;
declare function GM_deleteValue(key: string): void;
declare function GM_listValues(): string[];
declare function GM_registerMenuCommand(label: string, fn: () => void): any;
declare function GM_unregisterMenuCommand(id: any): void;
declare function GM_setClipboard(text: string, info?: any): void;
declare function GM_addValueChangeListener(key: string, fn: (key: string, oldValue: any, newValue: any, remote: boolean) => void): any;
declare function GM_removeValueChangeListener(id: any): void;
declare const GM_info: { script: { version: string } } | undefined;
