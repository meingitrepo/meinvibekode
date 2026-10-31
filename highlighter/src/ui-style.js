    // =====================================================================
    // On-page UI: selection toolbar, note card, note editor and toast.
    //
    // Styled after Anthropic's own interfaces: warm parchment surfaces, a serif for text and a sans
    // for chrome, hairline borders instead of shadows, and one clay accent that only the primary
    // action (Save) uses. Icons are Phosphor Icons (Light), drawn in slate
    // here. Fonts are never loaded: the stacks name Anthropic's fonts first, then Georgia and
    // Inter, so the script looks right where those are installed (see the notes at the top).
    //
    // Everything lives in a closed shadow root, so page CSS can't restyle it and its CSS can't
    // leak into the page. Built with createElement (never innerHTML) so pages that enforce
    // Trusted Types don't block it.
    // =====================================================================

    function makeEl(tag, props = {}, children = []) {
        const node = document.createElement(tag);
        Object.keys(props).forEach(k => {
            if (k === 'class') node.className = props[k];
            else if (k === 'text') node.textContent = props[k];
            else node.setAttribute(k, props[k]);
        });
        children.forEach(c => node.appendChild(c));
        return node;
    }


    function svgEl(tag, attrs) {
        const node = document.createElementNS(SVG_NS, tag);
        Object.keys(attrs).forEach(k => node.setAttribute(k, String(attrs[k])));
        return node;
    }

    // Phosphor Icons, Light weight (@phosphor-icons/core), path data as published (viewBox 0 0 256 256);
    // push-pin-fill is the Fill weight, used for a pinned note. Copyright (c) 2020-present Phosphor Icons.
    // MIT License: https://github.com/phosphor-icons/core
    const PHOSPHOR_ICONS = {
        'highlighter': 'M252.24,107.76a6,6,0,0,0-8.48,0L193.41,158.1a2,2,0,0,1-2.82,0L105.9,73.41a2,2,0,0,1,0-2.82l50.34-50.35a6,6,0,0,0-8.48-8.48L97.41,62.1A14,14,0,0,0,95.7,79.81L73.41,102.1a14,14,0,0,0,0,19.8l6.1,6.1L19.76,187.76a6,6,0,0,0,2.34,9.93l72,24a6,6,0,0,0,6.14-1.45L136,184.49l6.1,6.1a14,14,0,0,0,19.8,0l22.28-22.29a14,14,0,0,0,17.72-1.71l50.34-50.35A6,6,0,0,0,252.24,107.76ZM94.38,209.14,35.11,189.38,88,136.49,127.51,176Zm59-27a2,2,0,0,1-2.82,0l-10.35-10.34h0l-48-48h0L81.9,113.41a2,2,0,0,1,0-2.82L104,88.49,175.51,160Z',
        'text-underline': 'M198,224a6,6,0,0,1-6,6H64a6,6,0,0,1,0-12H192A6,6,0,0,1,198,224Zm-70-26a62.07,62.07,0,0,0,62-62V56a6,6,0,0,0-12,0v80a50,50,0,0,1-100,0V56a6,6,0,0,0-12,0v80A62.07,62.07,0,0,0,128,198Z',
        'text-strikethrough': 'M222,128a6,6,0,0,1-6,6H169.45c11.28,6.92,20.55,17.38,20.55,34,0,25.36-27.81,46-62,46s-62-20.64-62-46a6,6,0,0,1,12,0c0,18.75,22.43,34,50,34s50-15.25,50-34c0-18.23-15.46-26.59-40.47-34H40a6,6,0,0,1,0-12H216A6,6,0,0,1,222,128ZM76.33,102a6.2,6.2,0,0,0,1.88-.3A6,6,0,0,0,82,94.13,19.74,19.74,0,0,1,81.11,88c0-19.38,20.16-34,46.89-34,19.58,0,35.56,7.81,42.74,20.89a6,6,0,0,0,10.52-5.78C171.94,52.13,152,42,128,42,94.43,42,69.11,61.77,69.11,88a31.62,31.62,0,0,0,1.52,9.87A6,6,0,0,0,76.33,102Z',
        'check': 'M228.24,76.24l-128,128a6,6,0,0,1-8.48,0l-56-56a6,6,0,0,1,8.48-8.48L96,191.51,219.76,67.76a6,6,0,0,1,8.48,8.48Z',
        'push-pin': 'M233.91,82.79,173.22,22.1a14,14,0,0,0-19.81,0L98.93,76.77c-9.52-3.25-34-8.34-59.71,12.41A14,14,0,0,0,38.1,110l49.71,49.71-44.05,44a6,6,0,1,0,8.48,8.48l44.05-44.05L146,217.89a14,14,0,0,0,9.9,4.11q.49,0,1,0a14,14,0,0,0,10.19-5.54c19.72-26.21,17.15-47.23,12.46-59.3l54.37-54.55A14,14,0,0,0,233.91,82.79ZM225.42,94.1h0l-57.27,57.46a6,6,0,0,0-1.11,6.92c9.94,19.88-1.71,40.32-9.54,50.72a2,2,0,0,1-3,.2L46.58,101.51a2,2,0,0,1,.18-3c12.5-10.09,24.5-12.76,33.7-12.76a42.13,42.13,0,0,1,17.25,3.41A6,6,0,0,0,104.64,88L161.9,30.59a2,2,0,0,1,2.83,0l60.69,60.68A2,2,0,0,1,225.42,94.1Z',
        'push-pin-fill': 'M235.33,104l-53.47,53.65c4.56,12.67,6.45,33.89-13.19,60A15.93,15.93,0,0,1,157,224c-.38,0-.75,0-1.13,0a16,16,0,0,1-11.32-4.69L96.29,171,53.66,213.66a8,8,0,0,1-11.32-11.32L85,159.71l-48.3-48.3A16,16,0,0,1,38,87.63c25.42-20.51,49.75-16.48,60.4-13.14L152,20.7a16,16,0,0,1,22.63,0l60.69,60.68A16,16,0,0,1,235.33,104Z',
        'note-blank': 'M208,34H48A14,14,0,0,0,34,48V208a14,14,0,0,0,14,14H156.69a13.94,13.94,0,0,0,9.9-4.1l51.31-51.31a13.94,13.94,0,0,0,4.1-9.9V48A14,14,0,0,0,208,34ZM46,208V48a2,2,0,0,1,2-2H208a2,2,0,0,1,2,2V154H160a6,6,0,0,0-6,6v50H48A2,2,0,0,1,46,208Zm120-6.49V166h35.52Z',
        'note': 'M90,96a6,6,0,0,1,6-6h64a6,6,0,0,1,0,12H96A6,6,0,0,1,90,96Zm6,38h64a6,6,0,0,0,0-12H96a6,6,0,0,0,0,12Zm32,20H96a6,6,0,0,0,0,12h32a6,6,0,0,0,0-12ZM222,48V156.69a13.94,13.94,0,0,1-4.1,9.9L166.59,217.9a13.94,13.94,0,0,1-9.9,4.1H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48ZM48,210H154V160a6,6,0,0,1,6-6h50V48a2,2,0,0,0-2-2H48a2,2,0,0,0-2,2V208A2,2,0,0,0,48,210Zm153.52-44H166v35.52Z',
        'pencil-simple': 'M225.9,74.78,181.21,30.09a14,14,0,0,0-19.8,0L38.1,153.41a13.94,13.94,0,0,0-4.1,9.9V208a14,14,0,0,0,14,14H92.69a13.94,13.94,0,0,0,9.9-4.1L225.9,94.58a14,14,0,0,0,0-19.8ZM94.1,209.41a2,2,0,0,1-1.41.59H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41L136,72.48,183.51,120ZM217.41,86.1,192,111.51,144.49,64,169.9,38.58a2,2,0,0,1,2.83,0l44.68,44.69a2,2,0,0,1,0,2.83Z',
        'pencil-simple-slash': 'M52.44,36A6,6,0,0,0,43.56,44L93.05,98.47,38.1,153.42a13.9,13.9,0,0,0-4.1,9.89V208a14,14,0,0,0,14,14H92.69a13.94,13.94,0,0,0,9.9-4.1L154.46,166l49.11,54a6,6,0,0,0,8.88-8.08ZM94.1,209.42a2,2,0,0,1-1.41.58H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41l54.54-54.54,45.25,49.78ZM225.91,74.79,181.22,30.1a14,14,0,0,0-19.8,0L119.75,71.77a6,6,0,0,0,8.48,8.49L136,72.48,183.52,120l-10.44,10.44a6,6,0,1,0,8.49,8.48l44.34-44.33A14,14,0,0,0,225.91,74.79ZM217.42,86.1,192,111.52,144.49,64l25.42-25.41a2,2,0,0,1,2.82,0l44.69,44.68A2,2,0,0,1,217.42,86.1Z',
        'eraser': 'M223.57,81.81,182.19,40.43a22,22,0,0,0-31.12,0L32.43,159.07a22,22,0,0,0,0,31.11L62.5,220.24A6,6,0,0,0,66.74,222H216a6,6,0,0,0,0-12H126.49l97.08-97.08A22,22,0,0,0,223.57,81.81ZM109.51,210H69.22l-28.3-28.3a10,10,0,0,1,0-14.15L96,112.48,151.52,168ZM215.08,104.44,160,159.51,104.48,104l55.08-55.07a10,10,0,0,1,14.14,0l41.38,41.37A10,10,0,0,1,215.08,104.44Z',
        'trash': 'M216,50H174V40a22,22,0,0,0-22-22H104A22,22,0,0,0,82,40V50H40a6,6,0,0,0,0,12H50V208a14,14,0,0,0,14,14H192a14,14,0,0,0,14-14V62h10a6,6,0,0,0,0-12ZM94,40a10,10,0,0,1,10-10h48a10,10,0,0,1,10,10V50H94ZM194,208a2,2,0,0,1-2,2H64a2,2,0,0,1-2-2V62H194ZM110,104v64a6,6,0,0,1-12,0V104a6,6,0,0,1,12,0Zm48,0v64a6,6,0,0,1-12,0V104a6,6,0,0,1,12,0Z',
        'check-square': 'M172.24,99.76a6,6,0,0,1,0,8.48l-56,56a6,6,0,0,1-8.48,0l-24-24a6,6,0,0,1,8.48-8.48L112,151.51l51.76-51.75A6,6,0,0,1,172.24,99.76ZM222,48V208a14,14,0,0,1-14,14H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48Zm-12,0a2,2,0,0,0-2-2H48a2,2,0,0,0-2,2V208a2,2,0,0,0,2,2H208a2,2,0,0,0,2-2Z',
        'square': 'M208,34H48A14,14,0,0,0,34,48V208a14,14,0,0,0,14,14H208a14,14,0,0,0,14-14V48A14,14,0,0,0,208,34Zm2,174a2,2,0,0,1-2,2H48a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2H208a2,2,0,0,1,2,2Z',
        'copy': 'M216,34H88a6,6,0,0,0-6,6V82H40a6,6,0,0,0-6,6V216a6,6,0,0,0,6,6H168a6,6,0,0,0,6-6V174h42a6,6,0,0,0,6-6V40A6,6,0,0,0,216,34ZM162,210H46V94H162Zm48-48H174V88a6,6,0,0,0-6-6H94V46H210Z',
        'x': 'M204.24,195.76a6,6,0,1,1-8.48,8.48L128,136.49,60.24,204.24a6,6,0,0,1-8.48-8.48L119.51,128,51.76,60.24a6,6,0,0,1,8.48-8.48L128,119.51l67.76-67.75a6,6,0,0,1,8.48,8.48L136.49,128Z',
        'caret-down': 'M212.24,100.24l-80,80a6,6,0,0,1-8.48,0l-80-80a6,6,0,0,1,8.48-8.48L128,167.51l75.76-75.75a6,6,0,0,1,8.48,8.48Z',
        'caret-right': 'M180.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L167.51,128,91.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,180.24,132.24Z',
        'magnifying-glass': 'M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z',
        'eye': 'M245.48,125.57c-.34-.78-8.66-19.23-27.24-37.81C201,70.54,171.38,50,128,50S55,70.54,37.76,87.76c-18.58,18.58-26.9,37-27.24,37.81a6,6,0,0,0,0,4.88c.34.77,8.66,19.22,27.24,37.8C55,185.47,84.62,206,128,206s73-20.53,90.24-37.75c18.58-18.58,26.9-37,27.24-37.8A6,6,0,0,0,245.48,125.57ZM128,194c-31.38,0-58.78-11.42-81.45-33.93A134.77,134.77,0,0,1,22.69,128,134.56,134.56,0,0,1,46.55,95.94C69.22,73.42,96.62,62,128,62s58.78,11.42,81.45,33.94A134.56,134.56,0,0,1,233.31,128C226.94,140.21,195,194,128,194Zm0-112a46,46,0,1,0,46,46A46.06,46.06,0,0,0,128,82Zm0,80a34,34,0,1,1,34-34A34,34,0,0,1,128,162Z',
        'eye-slash': 'M52.44,36A6,6,0,0,0,43.56,44L64.44,67c-37.28,21.9-53.23,57-53.92,58.57a6,6,0,0,0,0,4.88c.34.77,8.66,19.22,27.24,37.8C55,185.47,84.62,206,128,206a124.91,124.91,0,0,0,52.57-11.25l23,25.29a6,6,0,0,0,8.88-8.08Zm48.62,71.32,45,49.52a34,34,0,0,1-45-49.52ZM128,194c-31.38,0-58.78-11.42-81.45-33.93A134.57,134.57,0,0,1,22.69,128c4.29-8.2,20.1-35.18,50-51.91L92.89,98.3a46,46,0,0,0,61.35,67.48l17.81,19.6A113.47,113.47,0,0,1,128,194Zm6.4-99.4a6,6,0,0,1,2.25-11.79,46.17,46.17,0,0,1,37.15,40.87,6,6,0,0,1-5.42,6.53l-.56,0a6,6,0,0,1-6-5.45A34.1,34.1,0,0,0,134.4,94.6Zm111.08,35.85c-.41.92-10.37,23-32.86,43.12a6,6,0,1,1-8-8.94A134.07,134.07,0,0,0,233.31,128a134.67,134.67,0,0,0-23.86-32.07C186.78,73.42,159.38,62,128,62a120.19,120.19,0,0,0-19.69,1.6,6,6,0,1,1-2-11.83A131.12,131.12,0,0,1,128,50c43.38,0,73,20.54,90.24,37.76,18.58,18.58,26.9,37,27.24,37.81A6,6,0,0,1,245.48,130.45Z',
        'warning': 'M235.07,189.09,147.61,37.22h0a22.75,22.75,0,0,0-39.22,0L20.93,189.09a21.53,21.53,0,0,0,0,21.72A22.35,22.35,0,0,0,40.55,222h174.9a22.35,22.35,0,0,0,19.6-11.19A21.53,21.53,0,0,0,235.07,189.09ZM224.66,204.8a10.46,10.46,0,0,1-9.21,5.2H40.55a10.46,10.46,0,0,1-9.21-5.2,9.51,9.51,0,0,1,0-9.72L118.79,43.21a10.75,10.75,0,0,1,18.42,0l87.46,151.87A9.51,9.51,0,0,1,224.66,204.8ZM122,144V104a6,6,0,0,1,12,0v40a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,180Z',
        'warning-circle': 'M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm0,192a90,90,0,1,1,90-90A90.1,90.1,0,0,1,128,218Zm-6-82V80a6,6,0,0,1,12,0v56a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,172Z',
        'info': 'M142,176a6,6,0,0,1-6,6,14,14,0,0,1-14-14V128a2,2,0,0,0-2-2,6,6,0,0,1,0-12,14,14,0,0,1,14,14v40a2,2,0,0,0,2,2A6,6,0,0,1,142,176ZM124,94a10,10,0,1,0-10-10A10,10,0,0,0,124,94Zm106,34A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z',
        'arrow-u-up-left': 'M230,144a62.07,62.07,0,0,1-62,62H80a6,6,0,0,1,0-12h88a50,50,0,0,0,0-100H46.49l37.75,37.76a6,6,0,1,1-8.48,8.48l-48-48a6,6,0,0,1,0-8.48l48-48a6,6,0,0,1,8.48,8.48L46.49,82H168A62.07,62.07,0,0,1,230,144Z',
        'arrow-u-up-right': 'M171.76,131.76,209.51,94H88a50,50,0,0,0,0,100h88a6,6,0,0,1,0,12H88A62,62,0,0,1,88,82H209.51L171.76,44.24a6,6,0,0,1,8.48-8.48l48,48a6,6,0,0,1,0,8.48l-48,48a6,6,0,0,1-8.48-8.48Z',
        'arrow-counter-clockwise': 'M222,128a94,94,0,0,1-92.74,94H128a93.43,93.43,0,0,1-64.5-25.65,6,6,0,1,1,8.24-8.72A82,82,0,1,0,70,70l-.19.19L39.44,98H72a6,6,0,0,1,0,12H24a6,6,0,0,1-6-6V56a6,6,0,0,1,12,0V90.34L61.63,61.4A94,94,0,0,1,222,128Z',
        'magnifying-glass': 'M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z',
        'list-checks': 'M222,128a6,6,0,0,1-6,6H128a6,6,0,0,1,0-12h88A6,6,0,0,1,222,128ZM128,70h88a6,6,0,0,0,0-12H128a6,6,0,0,0,0,12Zm88,116H128a6,6,0,0,0,0,12h88a6,6,0,0,0,0-12ZM83.76,43.76,56,71.51,44.24,59.76a6,6,0,0,0-8.48,8.48l16,16a6,6,0,0,0,8.48,0l32-32a6,6,0,0,0-8.48-8.48Zm0,64L56,135.51,44.24,123.76a6,6,0,1,0-8.48,8.48l16,16a6,6,0,0,0,8.48,0l32-32a6,6,0,0,0-8.48-8.48Zm0,64L56,199.51,44.24,187.76a6,6,0,0,0-8.48,8.48l16,16a6,6,0,0,0,8.48,0l32-32a6,6,0,0,0-8.48-8.48Z',
        'cursor-text': 'M92,44h72v12h-72ZM122,50h12v156h-12ZM92,200h72v12h-72Z',
        'cursor-text-slash': 'M92,44h72v12h-72ZM122,50h12v54h-12ZM122,153h12v53h-12ZM92,200h72v12h-72ZM48.4,32L216.4,216L207.6,224L39.6,40Z',
        'keyboard': 'M224,50H32A14,14,0,0,0,18,64V192a14,14,0,0,0,14,14H224a14,14,0,0,0,14-14V64A14,14,0,0,0,224,50Zm2,142a2,2,0,0,1-2,2H32a2,2,0,0,1-2-2V64a2,2,0,0,1,2-2H224a2,2,0,0,1,2,2Zm-20-64a6,6,0,0,1-6,6H56a6,6,0,0,1,0-12H200A6,6,0,0,1,206,128Zm0-32a6,6,0,0,1-6,6H56a6,6,0,0,1,0-12H200A6,6,0,0,1,206,96ZM70,160a6,6,0,0,1-6,6H56a6,6,0,0,1,0-12h8A6,6,0,0,1,70,160Zm96,0a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h64A6,6,0,0,1,166,160Zm40,0a6,6,0,0,1-6,6h-8a6,6,0,0,1,0-12h8A6,6,0,0,1,206,160Z',
        'keyboard-slash': 'M105.8,50L224,50A14,14,0,0,1,238,64L238,192A14,14,0,0,1,237.36,196.18A6,6,0,0,1,225.91,192.6A14,14,0,0,0,226,192L226,64A14,14,0,0,0,224,62L105.8,62A6,6,0,0,1,105.8,50ZM150.24,206L32,206A14,14,0,0,1,18,192L18,64A14,14,0,0,1,18.65,59.77A6,6,0,0,1,30.09,63.4A14,14,0,0,0,30,64L30,192A14,14,0,0,0,32,194L150.24,194A6,6,0,0,1,150.24,206ZM142.17,90L200,90A6,6,0,0,1,200,102L142.17,102A6,6,0,0,1,142.17,90ZM56,122L84.77,122A6,6,0,0,1,84.77,134L56,134A6,6,0,0,1,56,122ZM171.27,122L200,122A6,6,0,0,1,200,134L171.27,134A6,6,0,0,1,171.27,122ZM56,154L64,154A6,6,0,0,1,64,166L56,166A6,6,0,0,1,56,154ZM96,154L113.86,154A6,6,0,0,1,113.86,166L96,166A6,6,0,0,1,96,154ZM52.44,36A6,6,0,0,0,43.56,44L203.57,220A6,6,0,0,0,212.45,211.92Z',
        'power': 'M122,128V48a6,6,0,0,1,12,0v80a6,6,0,0,1-12,0Zm57.28-77A6,6,0,0,0,172.72,61C196.41,76.47,210,100.88,210,128a82,82,0,0,1-164,0c0-27.12,13.59-51.53,37.28-67A6,6,0,0,0,76.72,51C49.57,68.68,34,96.75,34,128a94,94,0,0,0,188,0C222,96.75,206.43,68.68,179.28,51Z'
    };

    // A Phosphor icon: one outline path on a 256 grid, scaled to the 20px of a button (the 16px of
    // an icon next to text, the panel's carets). `under` and `over` are extra shapes (on the same
    // 256 grid) drawn beneath or on top of it, used to paint parts of an icon in an annotation's
    // color. Weight comes from the icon's name (push-pin-fill); the icon takes the text color.
    function phosphorIcon(name, { under = [], over = [] } = {}) {
        const size = /^caret-/.test(name) ? 16 : 20;
        const svg = svgEl('svg', { class: `icon icon-${size}`, viewBox: '0 0 256 256', 'aria-hidden': 'true', focusable: 'false' });
        under.forEach(s => svg.appendChild(s));
        svg.appendChild(svgEl('path', { d: PHOSPHOR_ICONS[name], class: 'ic' }));
        over.forEach(s => svg.appendChild(s));
        return svg;
    }

    const SANS_FONT = '"Source Sans 3", Arial, sans-serif';
    const SERIF_FONT = '"Source Serif 4", Georgia, ui-serif, serif';

    // Colors from the Anthropic style reference: slate #141413, ivory #faf9f5 / #e8e6dc, oat #e3dacc,
    // manilla #f5e3c7, cloud #b0aea5 / #87867f, clay #d97757 / #c6613f. Tokens are named by role:
    // --ink* for text and filled controls (slate in light, ivory in dark), --surface* for backgrounds,
    // --line* for hairlines, and --accent* (clay), held back for a small highlight; the primary action is filled with --ink. The annotations panel and the toast follow the page's
    // theme, which can differ from that of the other panels (see openPanel and showToast).
    const LIGHT_TOKENS = `
        --ink: #141413;
        --ink-2: #3d3d3a;
        --ink-disabled: #b0aea5;
        --ink-3: #66655f;
        --ink-4: #73726c;   /* placeholders: 4.6:1 on ivory (cloud #87867f is 3.5:1) */
        --surface: #faf9f5;
        --surface-hover: #e8e6dc;
        --surface-pressed: #e3dacc;
        --surface-selected: #f5e3c7;
        --line: #e8e6dc;
        --line-hover: #d1cfc5;
        --line-pressed: #87867f;
        --line-strong: #87867f;
        --line-disabled: #e3dacc;
        --ink-pressed: #141413;
        --on-ink: #faf9f5;
        --danger: #a8321a;
        --success: #55683c;
        --warning: #b4532f;
        --accent: #d97757;
        --accent-hover: #c6613f;
        --accent-pressed: #b0553a;
        --on-accent: #141413;
        --focus-inner: #faf9f5;
        --focus: #141413;
        --transparent-stroke: transparent;
        --overlay: rgba(20, 20, 19, 0.4);
        --radius-sm: 2px;
        --radius-md: 4px;
        --radius-button: 8px;
        --radius-lg: 12px;
        --radius-card: 16px;
        --text-sm: 12px;   /* type scale: captions, hints, meta */
        --leading-sm: 16px;
        --text-md: 16px;   /* body and controls */
        --leading-md: 24px;
        --divider: #e8e6dc;
        --duration-fast: 100ms;
        --duration-normal: 150ms;
        --duration-slow: 300ms;
        --ease-out: ease-out;   /* Anthropic motion: short, calm fades */
        --color-scheme: light;
    `;
    // The reference only has a dark footer, so dark is its inversion: slate surfaces, ivory text,
    // darker hairlines.
    const DARK_TOKENS = `
        --ink: #faf9f5;
        --ink-2: #cccbc8;
        --ink-disabled: #5c5b56;
        --ink-3: #b0aea5;
        --ink-4: #87867f;
        --surface: #141413;
        --surface-hover: #1f1f1d;
        --surface-pressed: #2a2a28;
        --surface-selected: #262624;
        --line: #3d3d3a;
        --line-hover: #4d4d49;
        --line-pressed: #5c5b56;
        --line-strong: #87867f;
        --line-disabled: #3d3d3a;
        --ink-pressed: #b0aea5;
        --on-ink: #141413;
        --danger: #e5867a;
        --success: #a3b88a;
        --warning: #e58f6f;
        --focus-inner: #141413;
        --focus: #faf9f5;
        --overlay: rgba(0, 0, 0, 0.5);
        --divider: #3d3d3a;
        --color-scheme: dark;
    `;
    const UI_CSS = `
        :host { all: initial; ${LIGHT_TOKENS} }
        :host([data-theme="dark"]) { ${DARK_TOKENS} }
        .panel[data-theme="light"], .toast[data-theme="light"], .pen[data-theme="light"], .everything[data-theme="light"], .sitemenu[data-theme="light"] { ${LIGHT_TOKENS} }
        .panel[data-theme="dark"], .toast[data-theme="dark"], .pen[data-theme="dark"], .everything[data-theme="dark"], .sitemenu[data-theme="dark"] { ${DARK_TOKENS} }
        [hidden]:not(.surface):not(.everything), .tip[hidden] { display: none !important; }
        /* Surfaces fade out rather than vanish: display flips last (allow-discrete), so the hidden attribute
           still takes effect at once for scripts. */
        .surface:not(.tip) { transition: opacity var(--duration-normal) var(--ease-out), display var(--duration-normal) allow-discrete; }
        .everything { transition: opacity var(--duration-normal) var(--ease-out), display var(--duration-normal) allow-discrete; }
        .everything[hidden] { display: none; opacity: 0; pointer-events: none; }
        .everything:not([hidden]) { animation: highlighter-fade var(--duration-normal) var(--ease-out); }
        @keyframes highlighter-fade { from { opacity: 0; } }
        .surface:not(.tip)[hidden] { display: none; opacity: 0; pointer-events: none; }
        /* Scrollbars (note box, card text, lists) follow our theme, not the page's. Set here, not on
           :host: the host's inline all: initial !important would reset it. */
        .surface, .everything { color-scheme: var(--color-scheme); }

        /* Every floating panel (toolbar, note preview, note editor, toast, tooltip) shares this
           surface: flat parchment with a 1px hairline instead of a shadow, 12px corners. The cards
           (note preview, note editor, panel, dialog, toast) take 16px, the tooltip 4px. */
        .surface {
            position: fixed; top: 0; left: 0; box-sizing: border-box;
            font-family: ${SANS_FONT}; font-size: var(--text-md); line-height: var(--leading-md); font-weight: 400;
            color: var(--ink); background: var(--surface);
            border: 1px solid var(--line); border-radius: var(--radius-lg);
            box-shadow: none;
            animation: highlighter-enter var(--duration-normal) var(--ease-out);
        }
        /* In the page, not the window: they scroll with their text (see uiHost). */
        .surface.toolbar, .surface.tip, .surface.card, .surface.editor { position: absolute; }
        .surface.card, .surface.editor, .surface.panel, .surface.everything-box { border-radius: var(--radius-card); }
        @keyframes highlighter-pin { from { border-color: var(--line-pressed); } }
        @keyframes highlighter-enter { from { opacity: 0; } }

        .icon { display: block; flex: none; fill: currentColor; }
        .icon-20 { width: 20px; height: 20px; }
        .icon-16 { width: 16px; height: 16px; }

        /* Button: subtle appearance, size medium (32px), the same in the toolbar and the
           panels, so every icon has the same padding (6px), hover square and spacing. */
        .btn {
            box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
            gap: 6px; min-width: 64px; height: 32px; margin: 0; padding: 0 12px;
            border: 1px solid transparent; border-radius: var(--radius-button);
            font-family: inherit; font-size: var(--text-md); line-height: var(--leading-md); font-weight: 400;
            cursor: pointer; outline: none; user-select: none; -webkit-tap-highlight-color: transparent;
            transition: background-color var(--duration-fast) var(--ease-out),
                        border-color var(--duration-fast) var(--ease-out),
                        color var(--duration-fast) var(--ease-out);
        }
        .btn:not(.btn-icon) { font-weight: 500; }
        .btn-icon { min-width: 0; width: 32px; padding: 0; }
        .btn-subtle { background: transparent; color: var(--ink-2); }
        /* A style the selected text already has: a subtle toggle button, checked. */
        .btn-subtle[aria-pressed="true"] { background: var(--surface-selected); color: var(--ink); }
        .btn-subtle[aria-pressed="true"] .icon { color: var(--ink); }
        .btn-subtle:hover { background: var(--surface-hover); color: var(--ink); }
        /* Pressed: also while a key holds a focused button down. */
        .btn-subtle:hover:active, .btn-subtle:active:focus-visible { background: var(--surface-pressed); color: var(--ink); }
        .btn-subtle:hover .icon { color: var(--ink); }
        .btn-subtle:hover:active .icon, .btn-subtle:active:focus-visible .icon { color: var(--ink); }
        /* Focus: a 2px ring with a 2px gap (it also shows in forced colors). */
        .btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; z-index: 1; }
        /* The one primary action, the note editor's Save: inverted ink (paper on dark), fully rounded like every
           other button (8px). Disabled while there is nothing to save, then as quiet as a subtle one. */
        .btn-primary { background: var(--ink); color: var(--on-ink); border-radius: var(--radius-button); }
        .btn-primary:hover { background: var(--ink-2); }
        .btn-primary:hover:active, .btn-primary:active:focus-visible { background: var(--ink-pressed); }
        .btn-primary:disabled, .btn-primary:disabled:hover, .btn-primary:disabled:active { background: transparent; color: var(--ink-disabled); cursor: not-allowed; }
        /* The disabled subtle button: */
        .btn-subtle:disabled, .btn-subtle:disabled:hover, .btn-subtle:disabled:active { background: transparent; color: var(--ink-disabled); cursor: not-allowed; }
        .btn-subtle:disabled .icon, .btn-subtle:disabled:hover .icon, .btn-subtle:disabled:active .icon { color: var(--ink-disabled); }

        /* Annotations selected by clicking them: a solid 1px outline around their lines' shape,
           black, or white on a dark page. */
        .select-box { position: absolute; top: 0; left: 0; pointer-events: none; color: #141413; }
        .select-box[data-theme="dark"] { color: #faf9f5; }
        .select-box svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .select-box path { fill: none; stroke: currentColor; stroke-width: 1; stroke-linejoin: round; }

        /* Toolbar */
        /* Flat like the other surfaces, with longer,
           hairline separators. */
        /* 4px padding: with 32px buttons the toolbar is 40px high, close to Edge's (about 42px). */
        .toolbar { display: flex; align-items: center; gap: round(2px, calc(1px / var(--dpr, 1))); padding: 4px 8px; }
        /* Idle fade-out (see TOOLBAR_IDLE_MS). Pointing at the toolbar brings it back at once. */
        .toolbar.fading { opacity: 0; transition: opacity var(--duration-slow) var(--ease-out); }
        .divider { flex: none; width: calc(1px / var(--dpr, 1)); height: 24px; margin: 0 round(10px, calc(1px / var(--dpr, 1))); background: var(--divider); }
        @media (pointer: coarse) { .toolbar .btn-icon { width: 40px; height: 40px; } }

        /* Tooltip */
        /* One line, kept inside the view: nowrap measures the tip at its full width wherever it last
           stood, so placePanel() can move it in from the edge instead of the edge squeezing it. */
        .tip { white-space: nowrap; max-width: calc(100vw - 8px); overflow: hidden; text-overflow: ellipsis; padding: 6px 8px; font-size: var(--text-sm); line-height: var(--leading-sm); border-radius: var(--radius-md); pointer-events: none; }
        .tip .kbd { margin-left: 8px; color: var(--ink-3); }
        /* Source Sans sits high in its line box: 1px of space above the text, 1px less below, same height. */
        .tip::before { content: ""; display: block; margin-top: 1px; }
        .tip::after { content: ""; display: block; margin-top: -1px; }

        /* Panels (note preview, note editor, toast) all have 12px padding. Their 32px icon buttons
           are pulled out by 4px with negative margins, so every button sits 8px from the panel's
           edges, every icon 14px, and neighbouring buttons are 2px apart. */

        /* Note preview */
        .card { width: max-content; min-width: 160px; max-width: min(320px, calc(100vw - 16px)); padding: 12px; }
        .card-text { font-family: ${SERIF_FONT}; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; overscroll-behavior: contain; }
        .card-text a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; border-radius: var(--radius-md); outline: none; }
        .card-text a:hover { color: var(--ink-2); }
        .card-text a:focus-visible { outline: 2px solid var(--focus); }
        .card[data-pinned] .card-footer { cursor: move; user-select: none; }
        .card[data-pinned] { z-index: -1; }   /* pinned previews sit under the Alt+O and Alt+Shift+O panels */
        .card-footer { display: flex; align-items: center; gap: 12px; margin: 4px -4px -8px 0; }
        .card-hint { flex: 1; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-3); }
        .card-actions { display: flex; gap: 2px; }

        /* Note editor, with an outline Textarea */
        /* As wide as its note box, which starts 292px wide (a 320px panel, the note preview at its
           widest) and can be dragged wider, never narrower. */
        .editor { max-width: calc(100vw - 16px); padding: 12px; }
        .editor-header { display: flex; align-items: center; justify-content: space-between; min-height: 32px; margin: -8px -4px 4px 0; }
        /* Save and Delete, icon only, at the top right. */
        .editor-actions { display: flex; align-items: center; gap: 2px; }
        .editor-title { font-weight: 500; }
        .field {
            position: relative; box-sizing: border-box; background: var(--surface);
            /* Anthropic input: one plain border on all four sides (3:1 on the page) that darkens to the text color on focus. */
            border: 1px solid var(--line-strong); border-radius: var(--radius-md);
            /* Clips the textarea (and its scrollbar) to the rounded corners. */
            overflow: hidden;
            transition: border-color 100ms ease-out;
        }
        .field:hover { border-color: var(--ink-3); }
        .field:focus-within { border-color: var(--ink); }
        textarea {
            /* Height is set by sizeNoteInput(): NOTE_MIN_LINES to NOTE_MAX_LINES, then it scrolls.
               The corner handle resizes it (and the panel) for the current edit only. */
            display: block; box-sizing: border-box; width: 292px; min-width: 292px; margin: 0; padding: 6px 12px;
            min-height: 32px; max-width: min(640px, calc(100vw - 50px)); max-height: 60vh;   /* 32px: one line */
            border: 0; outline: 0; resize: both; overflow-y: auto; overscroll-behavior: contain; background: transparent;
            color: var(--ink); font: inherit; font-family: ${SERIF_FONT};
        }
        textarea::placeholder { color: var(--ink-4); opacity: 1; }
        /* width 0 + min-width 100%: the hint wraps to the note box's width instead of widening the
           panel, which would leave the box's border wider than the textarea and its scrollbar. */
        .field-hint { letter-spacing: .01em; width: 0; min-width: 100%; margin-top: 4px; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-3); }
        /* Toast */
        /* A tooltip's size and style, centred at the bottom of the view: the same padding, 12px type and
           radius as .tip, an icon at the left end, no dismiss button; it fades on its own. */
        .toast { top: auto; left: 50%; right: auto; bottom: 16px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; width: max-content; max-width: calc(100vw - 32px); padding: 6px 8px; font-size: var(--text-sm); line-height: var(--leading-sm); border-radius: var(--radius-md); }
        .toast > .icon { flex: none; width: 16px; height: 16px; margin: 0 0 0 -2px; }   /* at the left end, 16px, as far in as an icon button's icon */
        .toast-content { flex: 1; min-width: 0; }
        .toast-text { font-weight: 400; }
        .toast:focus-visible { outline: 2px solid var(--focus); }
        /* The pen's bar, centred at the top of the view. */
        .pen { top: 12px; right: 0; margin: 0 auto; width: max-content; max-width: calc(100vw - 32px); display: flex; align-items: center; gap: round(2px, calc(1px / var(--dpr, 1))); padding: 4px 8px; }
        /* The sticky menu: the site switch, with a row of icon buttons expanding to its right. */
        .sitemenu { display: flex; align-items: center; padding: 4px; width: max-content; cursor: grab; }
        .sitemenu .btn { cursor: pointer; }
        .sitemenu-handle { position: relative; align-self: stretch; width: 12px; cursor: grab; }
        /* A hairline bar, darker under the pointer. */
        .sitemenu-handle::before { content: ''; position: absolute; top: 50%; left: 4px; width: 2px; height: 16px; margin-top: -8px; border-radius: 1px; background: var(--line-strong); transition: background-color var(--duration-fast) var(--ease-out); }
        .sitemenu-handle:hover::before, .sitemenu-handle:active::before { background: var(--ink-3); }
        @media (prefers-reduced-motion: reduce) { .sitemenu-handle::before { transition: none; } }
        .sitemenu-expand { display: flex; justify-content: center; }
        .sitemenu-expand .icon { transform: rotate(-90deg); transition: transform var(--duration-normal) var(--ease-out); }
        .sitemenu-expand [aria-expanded="true"] .icon { transform: rotate(90deg); }
        @media (prefers-reduced-motion: reduce) { .sitemenu-expand .icon { transition: none; } }
        .sitemenu-tools { display: grid; grid-template-columns: 0fr; opacity: 0; transition: grid-template-columns var(--duration-normal) var(--ease-out), opacity var(--duration-normal) var(--ease-out); }
        .sitemenu[data-open] .sitemenu-tools { grid-template-columns: 1fr; opacity: 1; }
        .sitemenu-inner { overflow: hidden; min-width: 0; display: flex; align-items: center; gap: 2px; }
        .sitemenu-inner > :first-child { margin-left: 2px; }
        @media (prefers-reduced-motion: reduce) { .sitemenu-tools { transition: none; } }
        /* Everything saved (Alt+Shift+O): a dialog over the dimmed page. */
        .everything { position: fixed; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px; box-sizing: border-box; background: var(--overlay); font-family: ${SANS_FONT}; font-size: var(--text-md); line-height: var(--leading-md); color: var(--ink); }
        .everything-box { position: relative; display: flex; flex-direction: column; width: min(600px, 100%); max-height: 100%; padding: 12px 0 0; }
        .everything-box .panel-header { margin: -8px 8px 4px 12px; }
        .everything-box .field { flex: none; margin: 0 12px 8px; }
        .help-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 12px 12px; overscroll-behavior: contain; }
        .help-row { display: flex; gap: 12px; padding: 6px 0; border-top: 1px solid var(--line); }
        .help-key { flex: none; width: 11em; color: var(--ink-3); }
        .help-text { font-family: ${SERIF_FONT}; overflow-wrap: anywhere; }
        .everything-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 8px 8px; overscroll-behavior: contain; }
        .page-head {
            display: flex; align-items: center; gap: 8px; width: 100%; margin: 0; padding: 6px 4px; border: 0;
            border-radius: var(--radius-md); background: none; font: inherit; color: inherit; text-align: left;
            cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .page-head:hover { background: var(--surface-hover); }
        .page-head:hover:active { background: var(--surface-pressed); }
        .page-head:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
        .page-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .page-host { font-weight: 500; }
        .page-path { margin-left: 6px; color: var(--ink-3); }
        .page-meta { flex: none; font-size: var(--text-sm); color: var(--ink-3); }
        .page-items { padding-left: 20px; }
        a.item-main { text-decoration: none; }

        /* Annotations panel: a panel along the right edge, above the page. */
        .panel {
            top: 8px; left: auto; right: 8px; display: flex; flex-direction: column;
            width: min(400px, calc(100vw - 16px)); max-height: calc(100vh - 16px); padding: 12px 0 0;
        }
        .panel-header { display: flex; align-items: center; gap: 8px; min-height: 32px; margin: -8px 8px 4px 12px; }   /* 12px left, 8px right: the icon buttons carry their own padding */
        .panel-title { font-weight: 500; color: var(--ink); }
        .panel-count { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-3); }
        .panel-actions { display: flex; align-items: center; gap: 2px; }
        .panel .field { flex: none; margin: 0 12px 8px; padding-bottom: 0; }
        .search-icon { position: absolute; left: 8px; top: 6px; color: var(--ink-3); pointer-events: none; }
        .field input {
            display: block; box-sizing: border-box; width: 100%; height: 32px; margin: 0; padding: 0 8px 0 32px;
            border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit;
        }
        .field input::placeholder { color: var(--ink-4); opacity: 1; }
        .field input::-webkit-search-cancel-button { display: none; }
        .panel-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 8px 8px; overscroll-behavior: contain; }
        .section-title { margin: 8px 4px 4px; font-size: var(--text-sm); line-height: var(--leading-sm); font-weight: 500; letter-spacing: .01em; color: var(--ink-3); }
        .empty { margin: 4px 4px 8px; color: var(--ink-3); }
        /* Checkbox: a 16px square with 2px corners, slate and a check mark when
           on, a slate outline with a smaller rounded square when mixed. */
        .check {
            appearance: none; flex: none; position: relative; width: 16px; height: 16px; margin: 0; cursor: pointer;
            border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: transparent;
            transition: background-color 100ms, border-color 100ms; box-sizing: border-box; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .check:hover { border-color: var(--ink-3); }
        .check:active { border-color: var(--ink-2); }
        .check:checked { border-color: var(--ink); background: var(--ink); }
        .check:checked:hover { border-color: var(--ink-2); background: var(--ink-2); }
        .check:checked:active { border-color: var(--ink-pressed); background: var(--ink-pressed); }
        .check:checked::after, .check:indeterminate::after {
            content: ""; position: absolute; inset: 0; background: var(--on-ink);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M9.76 3.2c.3.29.32.76.04 1.06l-4.25 4.5a.75.75 0 0 1-1.08.02L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.7 1.7L8.7 3.24a.75.75 0 0 1 1.06-.04'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M9.76 3.2c.3.29.32.76.04 1.06l-4.25 4.5a.75.75 0 0 1-1.08.02L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.7 1.7L8.7 3.24a.75.75 0 0 1 1.06-.04'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
        }
        .check:indeterminate { border-color: var(--ink); }
        .check:indeterminate::after {
            background: var(--ink);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
        }
        .check:indeterminate:hover { border-color: var(--ink-2); }
        .check:indeterminate:hover::after { background: var(--ink-2); }
        .check:indeterminate:active { border-color: var(--ink-pressed); }
        .check:indeterminate:active::after { background: var(--ink-pressed); }
        .check:disabled, .check:disabled:hover, .check:disabled:active { cursor: default; border-color: var(--line-disabled); background: transparent; }
        .check:disabled::after { background: var(--ink-disabled); }
        .check:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
        .item .check { margin: 12px 8px 0 4px; opacity: 0; }
        .item:hover .check, .item .check:checked, .item .check:focus-visible { opacity: 1; }
        @media (hover: none) { .item .check { opacity: 1; } }
        .item { display: flex; align-items: flex-start; border-radius: var(--radius-md); }
        .item + .item { margin-top: 2px; }
        .item:has(.check:checked) { background: var(--surface-selected); }
        .item:hover { background: var(--surface-hover); }
        .item:hover:active { background: var(--surface-pressed); }
        /* The annotation itself: a button that scrolls to it. The bar at its left is its color. */
        .item-main {
            position: relative; flex: 1; min-width: 0; display: block; margin: 0; padding: 6px 4px 6px 12px;
            border: 0; border-radius: var(--radius-md); background: none; text-align: left;
            font: inherit; color: inherit; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .item-main:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
        .item-main::before { content: ""; position: absolute; left: 4px; top: 8px; bottom: 8px; width: 4px; border-radius: 2px; background: var(--swatch); }
        .item-text, .item-note { font-family: ${SERIF_FONT}; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
        .item-text { -webkit-line-clamp: 3; line-height: 1.25; text-wrap: pretty; }
        .item-note { -webkit-line-clamp: 4; white-space: pre-wrap; margin-top: 4px; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-2); }
        .item-meta { margin-top: 4px; letter-spacing: .01em; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-3); }
        .item-actions { display: flex; align-items: center; gap: 2px; padding: 4px 4px 0 0; opacity: 0; }
        .item:hover .item-actions, .item:focus-within .item-actions { opacity: 1; }
        @media (hover: none) { .item-actions { opacity: 1; } }
        .item-actions .btn:not(.btn-icon) { min-width: 0; }
        /* Not found: its actions sit below its text, always shown. */
        .missing { flex-direction: column; align-items: stretch; }
        .missing .item-main { cursor: default; padding-bottom: 2px; }
        .missing .item-main::before { opacity: 0.5; }
        .missing .item-actions { opacity: 1; padding: 0 4px 6px 6px; }

        @media (prefers-reduced-motion: reduce) {
            .surface, .everything { animation: none !important; transition: none; }
            .btn, .field::after, .toolbar.fading { transition: none; }
        }
        @media (forced-colors: active) {
            .surface { border-color: CanvasText; }
            .btn { border-color: ButtonText; }
            .btn[aria-pressed="true"] { background: Highlight; }
            .btn[aria-pressed="true"] .icon { color: HighlightText; }
            .field::after { background: Highlight; }
            .check { border-color: ButtonText; }
            .check:checked, .check:checked:hover, .check:checked:active { border-color: Highlight; background: Highlight; }
            .check:checked::after { background: HighlightText; }
            .check:indeterminate, .check:indeterminate:hover, .check:indeterminate:active { border-color: Highlight; }
            .check:indeterminate::after, .check:indeterminate:hover::after, .check:indeterminate:active::after { background: Highlight; }
            .check:disabled, .check:disabled:hover, .check:disabled:active { border-color: GrayText; }
            .check:disabled::after { background: GrayText; }
            .item:hover, .item:has(.check:checked), .page-head:hover { background: Highlight; color: HighlightText; }
            .item:hover *, .item:has(.check:checked) *, .page-head:hover * { color: HighlightText; }
            .item-main:focus-visible, .page-head:focus-visible, .check:focus-visible { outline-color: CanvasText; }
            .item-main::before { forced-color-adjust: none; }
            .select-box path { stroke: Highlight; }
            .sitemenu-handle::before, .sitemenu-handle:hover::before, .sitemenu-handle:active::before { forced-color-adjust: none; background: CanvasText; }
        }
    `;

