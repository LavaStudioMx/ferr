/** @odoo-module */
import { OdooEditor } from "@web_editor/../lib/odoo-editor/src/OdooEditor";
import { isMacOS } from "@web/core/browser/feature_detection";
const KEYBOARD_TYPES = { VIRTUAL: 'VIRTUAL', PHYSICAL: 'PHYSICAL', UNKNOWN: 'UKNOWN' };
const IS_KEYBOARD_EVENT_UNDO = ev => ev.key === 'z' && (ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_REDO = ev => ev.key === 'y' && (ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_BOLD = ev => ev.key === 'b' && (ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_ITALIC = ev => ev.key === 'i' && (ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_UNDERLINE = ev => ev.key === 'u' && (ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_STRIKETHROUGH = ev => ev.key === '5' && (ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_LEFT_ARROW = ev => ev.key === 'ArrowLeft' && !(ev.ctrlKey || ev.metaKey);
const IS_KEYBOARD_EVENT_RIGHT_ARROW = ev => ev.key === 'ArrowRight' && !(ev.ctrlKey || ev.metaKey);
const UNBREAKABLE_ROLLBACK_CODE = 'UNBREAKABLE';
import {
    closestBlock,
    commonParentGet,
    containsUnremovable,
    DIRECTIONS,
    endPos,
    ensureFocus,
    getCursorDirection,
    getFurthestUneditableParent,
    getListMode,
    getOuid,
    insertText,
    isColorGradient,
    nodeSize,
    preserveCursor,
    setCursorStart,
    setSelection,
    startPos,
    toggleClass,
    closestElement,
    isVisible,
    rgbToHex,
    isFontAwesome,
    getInSelection,
    getDeepRange,
    getRowIndex,
    getColumnIndex,
    ancestors,
    firstLeaf,
    previousLeaf,
    nextLeaf,
    isUnremovable,
    fillEmpty,
    isEmptyBlock,
    getUrlsInfosInString,
    URL_REGEX,
    URL_REGEX_WITH_INFOS,
    isSelectionFormat,
    YOUTUBE_URL_GET_VIDEO_ID,
    unwrapContents,
    peek,
    rightPos,
    getAdjacentPreviousSiblings,
    getAdjacentNextSiblings,
    rightLeafOnlyNotBlockPath,
    isBlock,
    getTraversedNodes,
    getSelectedNodes,
    isVisibleTextNode,
    descendants,
    hasValidSelection,
    hasTableSelection,
    pxToFloat,
    parseHTML,
    splitTextNode
} from '@web_editor/../lib/odoo-editor/src/utils/utils';

// override the _onKeyDown method to customize its behavior
OdooEditor.prototype._onKeyDown = function _onKeyDown(ev) {
    if($('#product_configure_model').length == 0 && $('#image_hotspot_configure_model').length == 0) {
        this.keyboardType =
            ev.key === 'Unidentified' ? KEYBOARD_TYPES.VIRTUAL : KEYBOARD_TYPES.PHYSICAL;
        if (/^.$/u.test(ev.key) && !ev.ctrlKey && !ev.metaKey && (isMacOS() || !ev.altKey)) {
            const selection = this.document.getSelection();
            if (selection && !selection.isCollapsed) {
                this.deleteRange(selection);
            }
        }
        if (ev.key === 'Backspace' && !ev.ctrlKey && !ev.metaKey) {
            const selection = this.document.getSelection();
            if (selection.isCollapsed) {
                ev.preventDefault();
                this._applyCommand('oDeleteBackward');
            }
        } else if (ev.key === 'Tab') {
            // Tab
            const sel = this.document.getSelection();
            const closestTag = (closestElement(sel.anchorNode, 'li, table', true) || {}).tagName;

            if (closestTag === 'LI') {
                this._applyCommand('indentList', ev.shiftKey ? 'outdent' : 'indent');
            } else if (closestTag === 'TABLE') {
                this._onTabulationInTable(ev);
            } else if (!ev.shiftKey) {
                this.execCommand('insertText', '\u00A0 \u00A0\u00A0');
            }
            ev.preventDefault();
            ev.stopPropagation();
        } else if (ev.shiftKey && ev.key === "Enter") {
            ev.preventDefault();
            this._applyCommand('oShiftEnter');
        } else if (IS_KEYBOARD_EVENT_UNDO(ev)) {
            // Ctrl-Z
            ev.preventDefault();
            ev.stopPropagation();
            this.historyUndo();
        } else if (IS_KEYBOARD_EVENT_REDO(ev)) {
            // Ctrl-Y
            ev.preventDefault();
            ev.stopPropagation();
            this.historyRedo();
        } else if (IS_KEYBOARD_EVENT_BOLD(ev)) {
            // Ctrl-B
            ev.preventDefault();
            ev.stopPropagation();
            this.execCommand('bold');
        } else if (IS_KEYBOARD_EVENT_ITALIC(ev)) {
            // Ctrl-I
            ev.preventDefault();
            ev.stopPropagation();
            this.execCommand('italic');
        } else if (IS_KEYBOARD_EVENT_UNDERLINE(ev)) {
            // Ctrl-U
            ev.preventDefault();
            ev.stopPropagation();
            this.execCommand('underline');
        } else if (IS_KEYBOARD_EVENT_STRIKETHROUGH(ev)) {
            // Ctrl-5 / Ctrl-shift-(
            ev.preventDefault();
            ev.stopPropagation();
            this.execCommand('strikeThrough');
        } else if (IS_KEYBOARD_EVENT_LEFT_ARROW(ev)) {
            getDeepRange(this.editable);
            const selection = this.document.getSelection();
            // Find previous character.
            let { focusNode, focusOffset } = selection;
            let previousCharacter = focusOffset > 0 && focusNode.textContent[focusOffset - 1];
            if (!previousCharacter) {
                focusNode = previousLeaf(focusNode);
                focusOffset = nodeSize(focusNode);
                previousCharacter = focusNode.textContent[focusOffset - 1];
            }
            // Move selection if previous character is zero-width space
            if (previousCharacter === '\u200B') {
                focusOffset -= 1;
                while (focusNode && (focusOffset < 0 || !focusNode.textContent[focusOffset])) {
                    focusNode = nextLeaf(focusNode);
                    focusOffset = focusNode && nodeSize(focusNode);
                }
                const startContainer = ev.shiftKey ? selection.anchorNode : focusNode;
                const startOffset = ev.shiftKey ? selection.anchorOffset : focusOffset;
                setSelection(startContainer, startOffset, focusNode, focusOffset);
            }
        } else if (IS_KEYBOARD_EVENT_RIGHT_ARROW(ev)) {
            getDeepRange(this.editable);
            const selection = this.document.getSelection();
            // Find next character.
            let { focusNode, focusOffset } = selection;
            let nextCharacter = focusNode.textContent[focusOffset];
            if (!nextCharacter) {
                focusNode = nextLeaf(focusNode);
                focusOffset = 0;
                nextCharacter = focusNode.textContent[focusOffset];
            }
            // Move selection if next character is zero-width space
            if (nextCharacter === '\u200B') {
                focusOffset += 1;
                while (focusNode && !focusNode.textContent[focusOffset]) {
                    focusNode = nextLeaf(focusNode);
                    focusOffset = 0;
                }
                const startContainer = ev.shiftKey ? selection.anchorNode : focusNode;
                const startOffset = ev.shiftKey ? selection.anchorOffset : focusOffset;
                setSelection(startContainer, startOffset, focusNode, focusOffset);
            }
        }
    }
     else {
        this._removeDomListener(this.editable, 'keydown', this._onKeyDown);
    }
}
// override the _onInput method to customize its behavior
OdooEditor.prototype._onInput = function _onInput(ev) {
    if($('#product_configure_model').length == 0 && $('#image_hotspot_configure_model').length == 0) {
        this._recordHistorySelection(true);
        const selection = this._currentStep.selection;
        const { anchorNodeOid, anchorOffset, focusNodeOid, focusOffset } = selection || {};
        const wasCollapsed =
            !selection || (focusNodeOid === anchorNodeOid && focusOffset === anchorOffset);
        const isChromeDeleteforward =
            ev.inputType === 'insertText' &&
            ev.data === null &&
            this._lastBeforeInputType === 'deleteContentForward';
        const isChromeInsertParagraph =
            ev.inputType === 'insertText' &&
            ev.data === null &&
            this._lastBeforeInputType === 'insertParagraph';
        if (this.keyboardType === KEYBOARD_TYPES.PHYSICAL || !wasCollapsed) {
            if (ev.inputType === 'deleteContentBackward') {
                this._compositionStep();
                this.historyRollback();
                ev.preventDefault();
                this._applyCommand('oDeleteBackward');
            } else if (ev.inputType === 'deleteContentForward' || isChromeDeleteforward) {
                this._compositionStep();
                this.historyRollback();
                ev.preventDefault();
                this._applyCommand('oDeleteForward');
            } else if (ev.inputType === 'insertParagraph' || isChromeInsertParagraph) {
                this._compositionStep();
                this.historyRollback();
                ev.preventDefault();
                if (this._applyCommand('oEnter') === UNBREAKABLE_ROLLBACK_CODE) {
                    const brs = this._applyCommand('oShiftEnter');
                    const anchor = brs[0].parentElement;
                    if (anchor.nodeName === 'A') {
                        if (brs.includes(anchor.firstChild)) {
                            brs.forEach(br => anchor.before(br));
                            setSelection(...rightPos(brs[brs.length - 1]));
                            this.historyStep();
                        } else if (brs.includes(anchor.lastChild)) {
                            brs.forEach(br => anchor.after(br));
                            setSelection(...rightPos(brs[0]));
                            this.historyStep();
                        }
                    }
                }
            } else if (['insertText', 'insertCompositionText'].includes(ev.inputType)) {
                // insertCompositionText, courtesy of Samsung keyboard.
                const selection = this.document.getSelection();
                // Detect that text was selected and change behavior only if it is the case,
                // since it is the only text insertion case that may cause problems.
                const wasTextSelected = anchorNodeOid !== focusNodeOid || anchorOffset !== focusOffset;
                // Unit tests events are not trusted by the browser,
                // the insertText has to be done manualy.
                const isUnitTests = !ev.isTrusted && this.testMode;
                // we cannot trust the browser to keep the selection inside empty tags.
                const latestSelectionInsideEmptyTag = this._isLatestComputedSelectionInsideEmptyInlineTag();
                if (wasTextSelected || isUnitTests || latestSelectionInsideEmptyTag) {
                    ev.preventDefault();
                    if (!isUnitTests) {
                        // First we need to undo the character inserted by the browser.
                        // Since the unit test Event is not trusted by the browser, we don't
                        // need to undo the char during the unit tests.
                        // @see https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted
                        this._applyRawCommand('oDeleteBackward');
                    }
                    if (latestSelectionInsideEmptyTag) {
                        // Restore the selection inside the empty Element.
                        const selectionBackup = this._latestComputedSelection;
                        setSelection(selectionBackup.anchorNode, selectionBackup.anchorOffset);
                    }
                    // When the spellcheck of Safari modify text, ev.data is
                    // null and the string can be found within ev.dataTranser.
                    insertText(selection, ev.data === null ? ev.dataTransfer.getData('text/plain') : ev.data);
                    selection.collapseToEnd();
                }
                // Check for url after user insert a space so we won't transform an incomplete url.
                if (
                    ev.data &&
                    ev.data === ' ' &&
                    selection &&
                    selection.anchorNode &&
                    !closestElement(selection.anchorNode).closest('a') &&
                    selection.anchorNode.nodeType === Node.TEXT_NODE &&
                    (!this.commandBar._active ||
                        this.commandBar._currentOpenOptions.closeOnSpace !== true)
                ) {
                    const textSliced = selection.anchorNode.textContent.slice(0, selection.anchorOffset);
                    const textNodeSplitted = textSliced.split(/\s/);

                    // Remove added space
                    textNodeSplitted.pop();
                    const potentialUrl = textNodeSplitted.pop();
                    const lastWordMatch = potentialUrl.match(URL_REGEX_WITH_INFOS);

                    if (lastWordMatch) {
                        const matches = getUrlsInfosInString(textSliced);
                        const match = matches[matches.length - 1];
                        this._createLinkWithUrlInTextNode(
                            selection.anchorNode,
                            match.url,
                            match.index,
                            match.length,
                        );
                    }
                    selection.collapseToEnd();
                }
                this.historyStep();
            } else if (ev.inputType === 'insertLineBreak') {
                this._compositionStep();
                this.historyRollback();
                ev.preventDefault();
                this._applyCommand('oShiftEnter');
            } else {
                this.historyStep();
            }
        } else if (ev.inputType === 'insertCompositionText') {
            this._fromCompositionText = true;
        }
    } else {
        this._removeDomListener(this.editable, 'input', this._onInput);
    }
}
// override the _onMouseUp method to customize its behavior
OdooEditor.prototype._onMouseUp = function _onMouseUp(ev){
    if($('#product_configure_model').length == 0 && $('#image_hotspot_configure_model').length == 0) {
        this._currentMouseState = ev.type;
        this._fixFontAwesomeSelection();
        this._fixSelectionOnContenteditableFalse();
    } else {
        this._removeDomListener(this.editable, 'mouseup', this._onMouseUp);
    }
}
// override the _onMouseDown method to customize its behavior
OdooEditor.prototype._onMouseDown = function _onMouseDown(ev) {
    if($('#product_configure_model').length == 0 && $('#image_hotspot_configure_model').length == 0) {
        this._currentMouseState = ev.type;
        const link = closestElement(ev.target, 'a');
        this.resetContenteditableLink();
        this._activateContenteditable();
        if (
            link && link.isContentEditable &&
            !link.querySelector('div') &&
            !closestElement(ev.target, '.o_not_editable')
        ) {
            this.setContenteditableLink(link);
        }
        // Ignore any changes that might have happened before this point.
        this.observer.takeRecords();

        const node = ev.target;
        // handle checkbox lists
        if (node.tagName == 'LI' && getListMode(node.parentElement) == 'CL') {
            const beforStyle = window.getComputedStyle(node, ':before');
            const style1 = {
                left: parseInt(beforStyle.getPropertyValue('left'), 10),
                top: parseInt(beforStyle.getPropertyValue('top'), 10),
            }
            style1.right = style1.left + parseInt(beforStyle.getPropertyValue('width'), 10);
            style1.bottom = style1.top + parseInt(beforStyle.getPropertyValue('height'), 10);

            const isMouseInsideCheckboxBox =
                ev.offsetX >= style1.left &&
                ev.offsetX <= style1.right &&
                ev.offsetY >= style1.top &&
                ev.offsetY <= style1.bottom;

            if (isMouseInsideCheckboxBox) {
                toggleClass(node, 'o_checked');
                ev.preventDefault();
                this.historyStep();
            }
        }
    } else {
        this._removeDomListener(this.editable, 'mousedown', this._onMouseDown);
    }
}
// override the _onDocumentKeydown method to customize its behavior
OdooEditor.prototype._onDocumentKeydown = function _onDocumentKeydown(ev) {
    if($('#product_configure_model').length == 0 && $('#image_hotspot_configure_model').length == 0) {
        const canUndoRedo = !['INPUT', 'TEXTAREA'].includes(this.document.activeElement.tagName);
        if (this.options.controlHistoryFromDocument && canUndoRedo) {
            if (IS_KEYBOARD_EVENT_UNDO(ev) && canUndoRedo) {
                ev.preventDefault();
                this.historyUndo();
            } else if (IS_KEYBOARD_EVENT_REDO(ev) && canUndoRedo) {
                ev.preventDefault();
                this.historyRedo();
            }
        } else {
            if (IS_KEYBOARD_EVENT_REDO(ev) || IS_KEYBOARD_EVENT_UNDO(ev)) {
                this._onKeyupResetContenteditableNodes.push(
                    ...this.editable.querySelectorAll('[contenteditable=true]'),
                );
                if (this.editable.getAttribute('contenteditable') === 'true') {
                    this._onKeyupResetContenteditableNodes.push(this.editable);
                }

                for (const node of this._onKeyupResetContenteditableNodes) {
                    this.automaticStepSkipStack();
                    node.setAttribute('contenteditable', false);
                }
            }
        }
    }
else {
        this._removeDomListener(this.editable, 'keydown', this._onDocumentKeydown);
    }
}
// override the _onDocumentKeyup method to customize its behavior
OdooEditor.prototype._onDocumentKeyup = function _onDocumentKeyup(ev) {
    if($('#product_configure_model').length == 0 && $('#image_hotspot_configure_model').length == 0) {
        if (this._onKeyupResetContenteditableNodes.length) {
            for (const node of this._onKeyupResetContenteditableNodes) {
                this.automaticStepSkipStack();
                node.setAttribute('contenteditable', true);
            }
            this._onKeyupResetContenteditableNodes = [];
        }
        this._fixSelectionOnContenteditableFalse();
    } else {
        this._removeDomListener(this.editable, 'keyup', this._onDocumentKeyup);
    }
}

return OdooEditor;