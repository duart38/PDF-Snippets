const OVERLAY_CLASS_NAME = '__pdf_extract_hover_overlay';
const SCRIPT_ID = '111_pdf_a_portion_111';
const PURGE_EVENT_NAME = '__pdf_extract_purge';



/**
 * Checks if the underlying document contains a script which indicates if our plugin has been inserted.
 * @param {*} scriptId The ID of the script that is injected.
 */
function isInjected(scriptId) {
    return document.getElementById(scriptId) ? true : false;
}

function inject(scriptId) {
    let script = document.createElement('script');
    script.id = scriptId;
    document.body.appendChild(script);
}

async function injectCSS(tabId) {
    try {
        await chrome.scripting.insertCSS({
            target: { tabId },
            css: `.${OVERLAY_CLASS_NAME} { background-color: red !important; }`,
        });
    } catch (err) {
        console.error(`failed to insert CSS: ${err}`);
    }
}

async function removeCSS(tabId) {
    try {
        await chrome.scripting.removeCSS({
            target: { tabId },
            css: `.${OVERLAY_CLASS_NAME} { background-color: red !important; }`,
        });
    } catch (err) {
        console.error(`failed to remove CSS: ${err}`);
    }
}

function sendPurgeEvent(purge_event_name) {
    document.dispatchEvent(new Event(purge_event_name));
}

function execute(overlay_class_name, purge_event_name, script_id) {
    /**
     * 
     * @param {HTMLElement} element 
     * @param {string} title 
     * @returns 
     */
    const printSection = (element) => {

        let printWindow = window.open('', 'PRINT', `height=650,width=900,top=100,left=150`);

        const links = 
                [...document.getElementsByTagName('link'), ...document.getElementsByTagName('style')]
                .filter(_=>_.rel?.includes("stylesheet") || _.innerText.length > 1)
                .map(_=>_.cloneNode(true));

        printWindow.document.write(`
<html>
    <head>
        <title>${document.title || document.URL} - ${new Date().toDateString()}</title>
    </head>
    <body>
        ${element.outerHTML}
    </body>
</html>`);

        printWindow.document.head.append(...links)

        printWindow.print();
        printWindow.close();
    }


    /** @param {MouseEvent} evt */
    let utility_mouseOver = (evt) => { evt.target.classList.add(overlay_class_name); }

    /** @param {MouseEvent} evt */
    const utility_mouseOut = (evt) => { evt.target.classList.remove(overlay_class_name); }

    /** @param {MouseEvent} evt */
    const utility_mouseClick = (evt) => { 
        printSection(evt.target); 
        document.dispatchEvent(new Event(purge_event_name));
    }
    /** @param {KeyboardEvent} evt */
    const utility_escKeyPress = (evt) => {
        if(evt.key === "Escape") document.dispatchEvent(new Event(purge_event_name));
    }

    document.addEventListener('mouseover', utility_mouseOver, false);
    document.addEventListener('mouseout', utility_mouseOut, false);
    document.addEventListener('click', utility_mouseClick, false);
    document.addEventListener('keydown', utility_escKeyPress, false);

    // TODO: register escape key as the undoing of the above!.
    document.addEventListener(purge_event_name, () => {
        document.removeEventListener('mouseover', utility_mouseOver);
        document.removeEventListener('mouseout', utility_mouseOut);
        document.removeEventListener('click', utility_mouseClick);
        document.removeEventListener('keydown', utility_escKeyPress);

        // in case one or more elements got the hover class still attached
        for (let e of document.getElementsByClassName(overlay_class_name)) e.classList.remove(overlay_class_name);

        document.getElementById(script_id)?.remove();
    })
}

chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            function: isInjected,
            args: [SCRIPT_ID]
        },
        async ([{ result }]) => {
            if (result === false || result === null) { // not injected
                console.log("not yet injected.. injecting now");
                await injectCSS(tab.id);
                chrome.scripting.executeScript({ target: { tabId: tab.id }, function: inject, args: [SCRIPT_ID] });
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: execute,
                    args: [OVERLAY_CLASS_NAME, PURGE_EVENT_NAME, SCRIPT_ID]
                });
            } else {
                // TODO: change icon to indicate that we are active.
                // injected and active.. removing
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: sendPurgeEvent,
                    args: [PURGE_EVENT_NAME
                    ]
                });
                await removeCSS(tab.id);
            }
        });
});