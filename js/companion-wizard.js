/**
 * Shared step wizard modal for Syllabus Companion.
 * window.CCPCompanionWizard
 */
(function (global) {
    let activeWizard = null;

    function t(key) {
        if (typeof global.__companionT === 'function') return global.__companionT(key);
        return key;
    }

    function escapeHtml(s) {
        return global.CCPUtils ? global.CCPUtils.escapeHtml(s) : String(s ?? '');
    }

    function ensureShell() {
        if (document.getElementById('companionWizardOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'companionWizardOverlay';
        overlay.className = 'companion-wizard-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="companion-wizard" role="dialog" aria-modal="true" aria-labelledby="companionWizardTitle">
                <div class="companion-wizard__header">
                    <div class="companion-wizard__header-top">
                        <h2 class="companion-wizard__title" id="companionWizardTitle"></h2>
                        <button type="button" class="companion-wizard__close" id="companionWizardClose" aria-label="">×</button>
                    </div>
                    <div class="companion-wizard__steps" id="companionWizardSteps"></div>
                </div>
                <div class="companion-wizard__body" id="companionWizardBody"></div>
                <div class="companion-wizard__footer">
                    <button type="button" class="btn btn-outline btn-small" id="companionWizardBack"></button>
                    <div class="companion-wizard__footer-right">
                        <button type="button" class="btn btn-outline btn-small" id="companionWizardSkip" hidden></button>
                        <button type="button" class="btn btn-primary btn-small" id="companionWizardNext"></button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('mousedown', (e) => {
            overlay.dataset.backdropDown = e.target === overlay ? '1' : '';
        });
        overlay.addEventListener('mouseup', (e) => {
            if (overlay.dataset.backdropDown === '1'
                && e.target === overlay
                && activeWizard
                && activeWizard.allowBackdropClose) {
                closeWizard();
            }
            overlay.dataset.backdropDown = '';
        });

        document.getElementById('companionWizardClose')?.addEventListener('click', () => {
            closeWizard();
        });

        document.getElementById('companionWizardBack')?.addEventListener('click', () => {
            if (!activeWizard) return;
            if (activeWizard.stepIndex > 0) {
                goToStep(activeWizard.stepIndex - 1);
            }
        });

        document.getElementById('companionWizardNext')?.addEventListener('click', async () => {
            if (!activeWizard) return;
            const step = activeWizard.steps[activeWizard.stepIndex];
            if (step && typeof step.onLeave === 'function') {
                const ok = await step.onLeave(activeWizard.ctx);
                if (ok === false) return;
            }
            if (activeWizard.stepIndex >= activeWizard.steps.length - 1) {
                try {
                    if (typeof activeWizard.onComplete === 'function') {
                        await activeWizard.onComplete(activeWizard.ctx);
                    }
                } catch (err) {
                    console.error('Wizard finish failed', err);
                } finally {
                    closeWizard();
                }
                return;
            }
            goToStep(activeWizard.stepIndex + 1);
        });

        document.getElementById('companionWizardSkip')?.addEventListener('click', async () => {
            if (!activeWizard) return;
            const step = activeWizard.steps[activeWizard.stepIndex];
            if (step && typeof step.onSkip === 'function') {
                await step.onSkip(activeWizard.ctx);
            }
            if (activeWizard.stepIndex >= activeWizard.steps.length - 1) {
                try {
                    if (typeof activeWizard.onComplete === 'function') {
                        await activeWizard.onComplete(activeWizard.ctx);
                    }
                } catch (err) {
                    console.error('Wizard skip-finish failed', err);
                } finally {
                    closeWizard();
                }
                return;
            }
            goToStep(activeWizard.stepIndex + 1);
        });
    }

    function renderStepDots() {
        const mount = document.getElementById('companionWizardSteps');
        if (!mount || !activeWizard) return;
        mount.innerHTML = activeWizard.steps.map((_, idx) => {
            const cls = idx < activeWizard.stepIndex
                ? 'is-done'
                : (idx === activeWizard.stepIndex ? 'is-active' : '');
            return `<div class="companion-wizard__step-dot ${cls}" aria-hidden="true"></div>`;
        }).join('');
    }

    function resolveLabel(step, field, keyField, fallbackKey) {
        if (!step) return fallbackKey ? t(fallbackKey) : '';
        if (step[keyField]) return t(step[keyField]);
        if (typeof step[field] === 'function') return step[field]();
        if (step[field] != null && step[field] !== '') return step[field];
        return fallbackKey ? t(fallbackKey) : '';
    }

    function renderStep() {
        if (!activeWizard) return;
        const step = activeWizard.steps[activeWizard.stepIndex];
        const titleEl = document.getElementById('companionWizardTitle');
        const bodyEl = document.getElementById('companionWizardBody');
        const backBtn = document.getElementById('companionWizardBack');
        const nextBtn = document.getElementById('companionWizardNext');
        const skipBtn = document.getElementById('companionWizardSkip');
        if (!step || !titleEl || !bodyEl || !backBtn || !nextBtn) return;

        const wizardTitle = activeWizard.titleKey
            ? t(activeWizard.titleKey)
            : (activeWizard.title || '');
        titleEl.textContent = resolveLabel(step, 'title', 'titleKey') || wizardTitle;
        const closeBtn = document.getElementById('companionWizardClose');
        if (closeBtn) closeBtn.setAttribute('aria-label', t('wizardClose'));
        bodyEl.innerHTML = typeof step.render === 'function' ? step.render(activeWizard.ctx) : '';
        if (typeof step.bind === 'function') {
            step.bind(bodyEl, activeWizard.ctx);
        }

        backBtn.textContent = activeWizard.stepIndex > 0
            ? resolveLabel(step, 'backLabel', 'backLabelKey', 'wizardBack')
            : t('wizardCancel');
        backBtn.onclick = activeWizard.stepIndex > 0
            ? null
            : () => closeWizard();

        const isLast = activeWizard.stepIndex >= activeWizard.steps.length - 1;
        nextBtn.textContent = isLast
            ? resolveLabel(step, 'finishLabel', 'finishLabelKey', 'wizardFinish')
            : resolveLabel(step, 'nextLabel', 'nextLabelKey', 'wizardNext');

        if (skipBtn) {
            const showSkip = !!step.allowSkip;
            skipBtn.hidden = !showSkip;
            skipBtn.textContent = resolveLabel(step, 'skipLabel', 'skipLabelKey', 'wizardSkip');
        }

        renderStepDots();
        if (typeof step.onEnter === 'function') {
            step.onEnter(activeWizard.ctx);
        }
    }

    function goToStep(index) {
        if (!activeWizard) return;
        activeWizard.stepIndex = Math.max(0, Math.min(index, activeWizard.steps.length - 1));
        renderStep();
    }

    function openWizard(options) {
        if (global.CCPCompanionGuides?.endSpotlightTour) {
            global.CCPCompanionGuides.endSpotlightTour();
        }
        ensureShell();
        activeWizard = {
            title: options.title || '',
            titleKey: options.titleKey || '',
            steps: options.steps || [],
            stepIndex: 0,
            ctx: options.ctx || {},
            onComplete: options.onComplete,
            allowBackdropClose: options.allowBackdropClose === true
        };
        const overlay = document.getElementById('companionWizardOverlay');
        if (overlay) overlay.hidden = false;
        renderStep();
    }

    function closeWizard() {
        const overlay = document.getElementById('companionWizardOverlay');
        if (overlay) overlay.hidden = true;
        activeWizard = null;
    }

    function isOpen() {
        return !!activeWizard;
    }

    function getCtx() {
        return activeWizard ? activeWizard.ctx : null;
    }

    function refreshLanguage() {
        if (!activeWizard) return;
        renderStep();
    }

    global.CCPCompanionWizard = {
        openWizard,
        closeWizard,
        goToStep,
        isOpen,
        getCtx,
        refreshLanguage,
        escapeHtml,
        t
    };
})(typeof window !== 'undefined' ? window : globalThis);
