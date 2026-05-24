// ═══════════════════════════════════════════════════════════════════
// EMF METHOD (Synchronous Impedance Method) — Enhanced Simulation
// ═══════════════════════════════════════════════════════════════════

let emfPlotData = [];
let emfLayout = {};
let animationStep = 0;
let animationInterval;
let isPaused = false;
let baseSpeed = 1000;
let calcResults = {};
let currentInputMode = 'manual';
let csvData = null;
let animationCancelled = false;

// ─── Initialization ────────────────────────────────────────────────
function initEmfGraph() {
    initGraph();

    document.getElementById('btnStart').addEventListener('click', startAnimation);
    document.getElementById('btnPause').addEventListener('click', () => { isPaused = true; updateStatusLED('paused'); });
    document.getElementById('btnResume').addEventListener('click', () => { isPaused = false; updateStatusLED('running'); });
    document.getElementById('btnReset').addEventListener('click', resetGraph);
    
    document.getElementById('speedSlider').addEventListener('input', (e) => {
        baseSpeed = 2000 / e.target.value;
    });

    document.getElementById('btnDownloadReport').addEventListener('click', generateReport);
    
    document.getElementById('tabManual').addEventListener('click', () => setInputMode('manual'));
    document.getElementById('tabCSV').addEventListener('click', () => setInputMode('csv'));
    document.getElementById('occCsvFileInput').addEventListener('change', handleOccCSVUpload);
    document.getElementById('sccCsvFileInput').addEventListener('change', handleSccCSVUpload);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmfGraph);
} else {
    initEmfGraph();
}

// ─── Input Mode Toggle ─────────────────────────────────────────────
function setInputMode(mode) {
    currentInputMode = mode;
    if (mode === 'manual') {
        document.getElementById('tabManual').className = 'btn btn-primary';
        document.getElementById('tabCSV').className = 'btn btn-secondary';
        document.getElementById('manualInputSection').style.display = 'block';
        document.getElementById('csvInputSection').style.display = 'none';
    } else {
        document.getElementById('tabCSV').className = 'btn btn-primary';
        document.getElementById('tabManual').className = 'btn btn-secondary';
        document.getElementById('csvInputSection').style.display = 'block';
        document.getElementById('manualInputSection').style.display = 'none';
    }
}

// ─── CSV Upload Handlers ──────────────────────────────────────────
function handleOccCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) throw new Error("Empty file");
            const occIf = [], occVoc = [], sccIf = [], sccIsc = [];
            let startRow = 0;
            if (lines[0].split(',').some(c => isNaN(parseFloat(c.trim())))) startRow = 1;
            let hasCombined = false;
            for (let i = startRow; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => parseFloat(c.trim()));
                if (cols.length >= 2 && !isNaN(cols[0]) && !isNaN(cols[1])) { occIf.push(cols[0]); occVoc.push(cols[1]); }
                if (cols.length >= 4 && !isNaN(cols[2]) && !isNaN(cols[3])) { sccIf.push(cols[2]); sccIsc.push(cols[3]); hasCombined = true; }
            }
            if (occIf.length === 0) throw new Error("No numeric data in columns 1 and 2.");
            if (!csvData) csvData = { occIf: [], occVoc: [], sccIf: [], sccIsc: [] };
            csvData.occIf = occIf; csvData.occVoc = occVoc;
            const el = document.getElementById('occCsvStatus');
            el.style.display = 'block';
            el.innerHTML = `<i class="fa-solid fa-circle-check"></i> OCC data loaded (${occIf.length} rows)`;
            if (hasCombined) {
                csvData.sccIf = sccIf; csvData.sccIsc = sccIsc;
                const sel = document.getElementById('sccCsvStatus');
                sel.style.display = 'block';
                sel.innerHTML = `<i class="fa-solid fa-circle-check"></i> SCC data loaded (${sccIf.length} rows) [Combined File]`;
                showToast('Combined OCC/SCC CSV Loaded Successfully!', 'success');
            } else {
                showToast('OCC CSV Loaded Successfully!', 'success');
            }
        } catch (error) { showToast('Failed to parse OCC CSV: ' + error.message, 'error'); }
    };
    reader.readAsText(file);
}

function handleSccCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) throw new Error("Empty file");
            const sccIf = [], sccIsc = [];
            let startRow = 0;
            if (lines[0].split(',').some(c => isNaN(parseFloat(c.trim())))) startRow = 1;
            for (let i = startRow; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => parseFloat(c.trim()));
                if (cols.length >= 2 && !isNaN(cols[0]) && !isNaN(cols[1])) { sccIf.push(cols[0]); sccIsc.push(cols[1]); }
            }
            if (sccIf.length === 0) throw new Error("No numeric data in columns 1 and 2.");
            if (!csvData) csvData = { occIf: [], occVoc: [], sccIf: [], sccIsc: [] };
            csvData.sccIf = sccIf; csvData.sccIsc = sccIsc;
            const el = document.getElementById('sccCsvStatus');
            el.style.display = 'block';
            el.innerHTML = `<i class="fa-solid fa-circle-check"></i> SCC data loaded (${sccIf.length} rows)`;
            showToast('SCC CSV Loaded Successfully!', 'success');
        } catch (error) { showToast('Failed to parse SCC CSV: ' + error.message, 'error'); }
    };
    reader.readAsText(file);
}

// ─── Graph Init ────────────────────────────────────────────────────
function initGraph() {
    emfLayout = {
        title: { 
            text: 'EMF Method — OCC & SCC Characteristics', 
            font: { family: 'Orbitron, sans-serif', color: 'var(--text-main)', size: 14 } 
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { 
            title: { text: 'Field Current (If) A', font: { family: 'Inter, sans-serif', size: 11 } }, 
            color: 'var(--text-muted)', 
            gridcolor: 'rgba(59, 130, 246, 0.08)',
            tickfont: { family: 'Orbitron, monospace', size: 9 }
        },
        yaxis: { 
            title: { text: 'Open Circuit Voltage (Voc) V', font: { family: 'Inter, sans-serif', size: 11 } }, 
            color: 'var(--text-muted)', 
            gridcolor: 'rgba(59, 130, 246, 0.08)',
            tickfont: { family: 'Orbitron, monospace', size: 9 }
        },
        yaxis2: {
            title: { text: 'Short Circuit Current (Isc) A', font: { family: 'Inter, sans-serif', size: 11 } },
            color: '#10b981',
            overlaying: 'y',
            side: 'right',
            gridcolor: 'transparent',
            tickfont: { family: 'Orbitron, monospace', size: 9 }
        },
        legend: { 
            font: { family: 'Inter, sans-serif', color: 'var(--text-main)', size: 10 },
            bgcolor: 'rgba(15, 23, 42, 0.6)'
        },
        hoverlabel: {
            bgcolor: 'rgba(8, 12, 24, 0.95)',
            bordercolor: 'rgba(0, 240, 255, 0.6)',
            font: { family: 'Orbitron, monospace', color: '#00f0ff', size: 11 }
        },
        margin: { l: 60, r: 70, t: 50, b: 50 }
    };
    Plotly.newPlot('emfGraph', [], emfLayout, { responsive: true, displayModeBar: false });
}

// ─── Parse Input ───────────────────────────────────────────────────
function parseInput() {
    let occIf, occVoc, sccIf, sccIsc;
    if (currentInputMode === 'manual') {
        occIf  = document.getElementById('occIf').value.split(',').filter(x => x.trim() !== '').map(Number);
        occVoc = document.getElementById('occVoc').value.split(',').filter(x => x.trim() !== '').map(Number);
        sccIf  = document.getElementById('sccIf').value.split(',').filter(x => x.trim() !== '').map(Number);
        sccIsc = document.getElementById('sccIsc').value.split(',').filter(x => x.trim() !== '').map(Number);
    } else {
        if (!csvData) throw new Error('Please upload a CSV file first');
        occIf = csvData.occIf; occVoc = csvData.occVoc;
        sccIf = csvData.sccIf; sccIsc = csvData.sccIsc;
    }
    const ratedV  = parseFloat(document.getElementById('ratedV').value);
    const ratedI  = parseFloat(document.getElementById('ratedI').value);
    const ra      = parseFloat(document.getElementById('ra').value);
    const pf      = parseFloat(document.getElementById('pf').value);
    const pfType  = document.getElementById('pfType').value;
    return { occIf, occVoc, sccIf, sccIsc, ratedV, ratedI, ra, pf, pfType };
}

// ─── Interpolation Helpers ─────────────────────────────────────────
function interpolateXtoY(xArr, yArr, xTarget) {
    for (let i = 0; i < xArr.length - 1; i++) {
        if (xTarget >= xArr[i] && xTarget <= xArr[i + 1]) {
            const slope = (yArr[i + 1] - yArr[i]) / (xArr[i + 1] - xArr[i]);
            return yArr[i] + slope * (xTarget - xArr[i]);
        }
    }
    const n = xArr.length;
    const slope = (yArr[n - 1] - yArr[n - 2]) / (xArr[n - 1] - xArr[n - 2]);
    return yArr[n - 1] + slope * (xTarget - xArr[n - 1]);
}

function interpolateYtoX(xArr, yArr, yTarget) {
    for (let i = 0; i < yArr.length - 1; i++) {
        if ((yTarget >= yArr[i] && yTarget <= yArr[i + 1]) || (yTarget <= yArr[i] && yTarget >= yArr[i + 1])) {
            const slope = (xArr[i + 1] - xArr[i]) / (yArr[i + 1] - yArr[i]);
            return xArr[i] + slope * (yTarget - yArr[i]);
        }
    }
    const n = xArr.length;
    const slope = (xArr[n - 1] - xArr[n - 2]) / (yArr[n - 1] - yArr[n - 2]);
    return xArr[n - 1] + slope * (yTarget - yArr[n - 1]);
}

// ─── Cubic Spline (Catmull-Rom) Interpolation ──────────────────────
function cubicSplineInterpolate(xData, yData, numPoints) {
    const n = xData.length;
    if (n < 2) return { x: [...xData], y: [...yData] };
    const xOut = [], yOut = [];
    for (let seg = 0; seg < n - 1; seg++) {
        const ptsInSeg = Math.max(2, Math.round(numPoints / (n - 1)));
        for (let j = 0; j < ptsInSeg; j++) {
            const t = j / ptsInSeg;
            const x = xData[seg] + t * (xData[seg + 1] - xData[seg]);
            const p0 = seg > 0 ? seg - 1 : seg;
            const p1 = seg, p2 = seg + 1;
            const p3 = seg + 2 < n ? seg + 2 : seg + 1;
            const t2 = t * t, t3 = t2 * t;
            const y = 0.5 * (
                (2 * yData[p1]) +
                (-yData[p0] + yData[p2]) * t +
                (2 * yData[p0] - 5 * yData[p1] + 4 * yData[p2] - yData[p3]) * t2 +
                (-yData[p0] + 3 * yData[p1] - 3 * yData[p2] + yData[p3]) * t3
            );
            xOut.push(x); yOut.push(y);
        }
    }
    xOut.push(xData[n - 1]); yOut.push(yData[n - 1]);
    return { x: xOut, y: yOut };
}

// ─── Find best Zs lookup index (closest to rated voltage) ──────────
function findBestZsIndex(occVoc, sccIsc, ratedV) {
    // Find OCC index whose voltage is closest to rated voltage
    // (standard textbook: Zs determined at rated terminal voltage)
    let bestIdx = 1;
    let bestDist = Infinity;
    for (let i = 0; i < occVoc.length; i++) {
        const dist = Math.abs(occVoc[i] - ratedV);
        if (dist < bestDist && i < sccIsc.length) {
            bestDist = dist;
            bestIdx = i;
        }
    }
    return Math.max(0, bestIdx);
}

// ─── Animation Primitives ──────────────────────────────────────────
function animateCurve(graphId, xData, yData, traceOptions, traceIndex) {
    return new Promise(resolve => {
        const interp = cubicSplineInterpolate(xData, yData, 80);
        const totalPts = interp.x.length;
        let drawn = 0;
        const batchSize = Math.max(1, Math.floor(totalPts / 40));
        const trace = Object.assign({ x: [], y: [], mode: 'lines' }, traceOptions);
        Plotly.addTraces(graphId, trace);
        function drawNext() {
            if (animationCancelled) { resolve(); return; }
            if (isPaused) { requestAnimationFrame(drawNext); return; }
            const end = Math.min(drawn + batchSize, totalPts);
            Plotly.extendTraces(graphId, { x: [interp.x.slice(drawn, end)], y: [interp.y.slice(drawn, end)] }, [traceIndex]);
            drawn = end;
            if (drawn < totalPts) setTimeout(() => requestAnimationFrame(drawNext), Math.max(10, baseSpeed / 40));
            else resolve();
        }
        requestAnimationFrame(drawNext);
    });
}

function animateLine(graphId, x0, y0, x1, y1, traceOptions, traceIndex) {
    return new Promise(resolve => {
        const steps = 30;
        let drawn = 0;
        const trace = Object.assign({ x: [x0], y: [y0], mode: 'lines' }, traceOptions);
        Plotly.addTraces(graphId, trace);
        function drawNext() {
            if (animationCancelled) { resolve(); return; }
            if (isPaused) { requestAnimationFrame(drawNext); return; }
            drawn++;
            const t = drawn / steps;
            Plotly.extendTraces(graphId, { x: [[x0 + t * (x1 - x0)]], y: [[y0 + t * (y1 - y0)]] }, [traceIndex]);
            if (drawn < steps) setTimeout(() => requestAnimationFrame(drawNext), Math.max(10, baseSpeed / 30));
            else resolve();
        }
        requestAnimationFrame(drawNext);
    });
}

function animatePoints(graphId, xPts, yPts, traceOptions, traceIndex) {
    return new Promise(resolve => {
        let drawn = 1;
        const trace = Object.assign({ x: [xPts[0]], y: [yPts[0]], mode: 'lines' }, traceOptions);
        Plotly.addTraces(graphId, trace);
        function drawNext() {
            if (animationCancelled) { resolve(); return; }
            if (isPaused) { requestAnimationFrame(drawNext); return; }
            const end = Math.min(drawn + 1, xPts.length);
            Plotly.extendTraces(graphId, { x: [xPts.slice(drawn, end)], y: [yPts.slice(drawn, end)] }, [traceIndex]);
            drawn = end;
            if (drawn < xPts.length) setTimeout(() => requestAnimationFrame(drawNext), Math.max(5, baseSpeed / 60));
            else resolve();
        }
        requestAnimationFrame(drawNext);
    });
}

async function animateStep(stepNum, text, action) {
    return new Promise(resolve => {
        const checkPause = setInterval(() => {
            if (!isPaused) {
                clearInterval(checkPause);
                document.getElementById('explanationText').innerHTML = `<strong>Step ${stepNum}:</strong> ${text}`;
                Promise.resolve(action()).then(() => setTimeout(resolve, Math.max(200, baseSpeed / 3)));
            }
        }, 100);
    });
}

// ─── Phasor Canvas Drawing ─────────────────────────────────────────
function drawPhasorDiagram(V, I, Ra, Xs, pf, pfType) {
    const canvas = document.getElementById('phasorCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const phi = Math.acos(pf);
    const sign = pfType === 'leading' ? -1 : 1;

    // Compute phasor components (phase quantities)
    const V_ph = V;
    const IRa = I * Ra;
    const IXs = I * Xs;
    const E0 = Math.sqrt(Math.pow(V_ph * pf + IRa, 2) + Math.pow(V_ph * Math.sin(phi) + sign * IXs, 2));

    // Scale to fit canvas — use E0 as reference
    const maxLen = E0 * 1.15;
    const scale = (Math.min(W, H) * 0.38) / maxLen;

    const cx = W * 0.2, cy = H * 0.55; // origin at lower-left area

    // Current reference direction: horizontal (0 degrees)
    // V is at angle phi ahead/behind current
    const V_angle = sign >= 1 ? phi : -phi; // lagging: V leads I by phi, so V at +phi

    const Vx = V_ph * Math.cos(V_angle) * scale;
    const Vy = -V_ph * Math.sin(V_angle) * scale; // canvas y is flipped

    // IRa: in phase with current (horizontal)
    const IRax = IRa * scale;
    const IRay = 0;

    // IXs: 90° ahead of current (vertical, upward on canvas = negative y)
    const IXsx = 0;
    const IXsy = -sign * IXs * scale;

    // Compute tip of (V + IRa) for connecting IXs
    // In phasor: V is at phi, IRa is in phase with I (0°)
    // For lagging load: E0 = V∠φ + I(Ra + jXs)
    const Vend_x = cx + Vx;
    const Vend_y = cy + Vy;
    const IRadend_x = Vend_x + IRax;
    const IRadend_y = Vend_y + IXsy; // IXs perpendicular to I (upward)
    
    // Actually rebuild properly:
    // Origin = tail of V phasor
    // Tip of V = (Vx, Vy) from origin
    // From tip of V, add IRa phasor (in phase with current direction = horizontal)
    const pIRa_x = Vend_x + IRax;
    const pIRa_y = Vend_y;
    // From tip of IRa, add IXs (perpendicular to I, upward = -y on canvas)
    const pIXs_x = pIRa_x;
    const pIXs_y = pIRa_y - sign * IXs * scale;

    // E0 goes from origin to tip of IXs
    const E0_tip_x = pIXs_x;
    const E0_tip_y = pIXs_y;

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Draw current reference arrow (horizontal dashed)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 120, cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText('I (ref)', cx + 125, cy + 4);

    function drawArrow(x0, y0, x1, y1, color, label, labelPos) {
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        if (len < 2) return;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Arrowhead
        const aLen = 10;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - aLen * Math.cos(angle - 0.35), y1 - aLen * Math.sin(angle - 0.35));
        ctx.lineTo(x1 - aLen * Math.cos(angle + 0.35), y1 - aLen * Math.sin(angle + 0.35));
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = color;
        const lx = labelPos ? labelPos.x : (x0 + x1) / 2 + 8;
        const ly = labelPos ? labelPos.y : (y0 + y1) / 2 - 6;
        ctx.fillText(label, lx, ly);
    }

    // Draw V phasor
    drawArrow(cx, cy, Vend_x, Vend_y, '#3b82f6', `V = ${V_ph.toFixed(1)}V`);
    // Draw IRa phasor
    drawArrow(Vend_x, Vend_y, pIRa_x, pIRa_y, '#10b981', `IRa = ${IRa.toFixed(1)}V`);
    // Draw IXs phasor
    drawArrow(pIRa_x, pIRa_y, pIXs_x, pIXs_y, '#ef4444', `IXs = ${(IXs).toFixed(1)}V`);
    // Draw E0 resultant
    ctx.setLineDash([8, 4]);
    drawArrow(cx, cy, E0_tip_x, E0_tip_y, '#a855f7', `E0 = ${E0.toFixed(1)}V`,
        { x: (cx + E0_tip_x) / 2 - 50, y: (cy + E0_tip_y) / 2 - 8 });
    ctx.setLineDash([]);

    // Right angle marker at IRa-IXs junction
    const sq = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pIRa_x - sq, pIRa_y);
    ctx.lineTo(pIRa_x - sq, pIRa_y - sign * sq);
    ctx.lineTo(pIRa_x, pIRa_y - sign * sq);
    ctx.stroke();

    // Legend
    const legend = document.getElementById('phasorLegend');
    legend.innerHTML = `
        <span style="color:#3b82f6"><i class="fa-solid fa-minus"></i> V (Terminal Voltage)</span>
        <span style="color:#10b981"><i class="fa-solid fa-minus"></i> I·Ra Drop</span>
        <span style="color:#ef4444"><i class="fa-solid fa-minus"></i> I·Xs Drop</span>
        <span style="color:#a855f7"><i class="fa-solid fa-minus" style="text-decoration:underline dotted"></i> E0 (Generated EMF)</span>
        <span style="color:rgba(255,255,255,0.35)">--- I (Current Reference)</span>
    `;
}

// ─── SVG Regulation Gauge ──────────────────────────────────────────
function drawRegulationGauge(regPercent) {
    const svg = document.getElementById('regGauge');
    const maxReg = 100;
    const clampedReg = Math.min(Math.max(regPercent, 0), maxReg);
    const fraction = clampedReg / maxReg;

    // Gauge arc from 180° to 0° (left to right)
    const cx = 100, cy = 100, r = 75;
    const startAngle = Math.PI; // 180°
    const endAngle = 0;         // 0°
    const needleAngle = startAngle + fraction * (endAngle - startAngle); // goes from π to 0

    // Color zones
    function arcPath(fromFrac, toFrac, color) {
        const a1 = Math.PI + fromFrac * Math.PI; // wait — we want left=0, right=max
        // Actually: start=180deg=left, end=0deg=right
        // fromFrac=0 → angle=π, fromFrac=1 → angle=0
        const ang1 = Math.PI - fromFrac * Math.PI;
        const ang2 = Math.PI - toFrac * Math.PI;
        const x1 = cx + r * Math.cos(ang1), y1 = cy - r * Math.sin(ang1);
        const x2 = cx + r * Math.cos(ang2), y2 = cy - r * Math.sin(ang2);
        const largeArc = (toFrac - fromFrac) > 0.5 ? 1 : 0;
        return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>`;
    }

    // Background track
    const bgX1 = cx + r * Math.cos(Math.PI), bgY1 = cy - r * Math.sin(Math.PI);
    const bgX2 = cx + r * Math.cos(0), bgY2 = cy - r * Math.sin(0);
    const bgArc = `<path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 0 1 ${bgX2} ${bgY2}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14"/>`;

    // Colored zone arcs
    const greenArc = arcPath(0, 0.20, '#10b981');
    const amberArc = arcPath(0.20, 0.40, '#f59e0b');
    const redArc   = arcPath(0.40, 1.0, '#ef4444');

    // Needle
    const needleX = cx + (r - 10) * Math.cos(Math.PI - fraction * Math.PI);
    const needleY = cy - (r - 10) * Math.sin(Math.PI - fraction * Math.PI);
    const needle = `<line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${regPercent > 40 ? '#ef4444' : regPercent > 20 ? '#f59e0b' : '#10b981'}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--text-muted)"/>`;

    // Tick labels
    const ticks = ['0', '20', '40', '60', '80', '100'].map((val, i) => {
        const frac = i / 5;
        const angle = Math.PI - frac * Math.PI;
        const tx = cx + (r + 14) * Math.cos(angle);
        const ty = cy - (r + 14) * Math.sin(angle);
        return `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="rgba(255,255,255,0.4)" font-family="monospace">${val}%</text>`;
    }).join('');

    svg.innerHTML = bgArc + greenArc + amberArc + redArc + needle + ticks;

    const color = regPercent > 40 ? '#ef4444' : regPercent > 20 ? '#f59e0b' : '#10b981';
    document.getElementById('gaugeLabel').innerHTML =
        `<span style="color:${color}; font-size:1.5rem;">${regPercent.toFixed(2)}%</span><br>
         <span style="color:var(--text-muted); font-size:0.75rem;">Voltage Regulation</span>`;
}

// ─── Main Animation ────────────────────────────────────────────────
async function startAnimation() {
    resetGraph();
    animationCancelled = false;
    let data;
    try {
        data = parseInput();
    } catch (e) {
        showToast(e.message, 'error');
        updateStatusLED('error');
        return;
    }

    if (data.occIf.length !== data.occVoc.length || data.occIf.some(isNaN)) {
        showToast('Invalid OCC Data', 'error');
        updateStatusLED('error');
        return;
    }

    updateStatusLED('running');
    document.getElementById('btnStart').disabled = true;
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('phasorCard').style.display = 'none';

    let traceIdx = 0;

    // ── Step 1: Plot OCC Points ──────────────────────────────────────
    await animateStep(1, "Plotting <b>Open Circuit Characteristic (OCC)</b> test data points. Each point is measured at no-load with varying field current.", () => {
        Plotly.addTraces('emfGraph', {
            x: data.occIf, y: data.occVoc,
            mode: 'markers', name: 'OCC Data Points',
            marker: { color: '#3b82f6', size: 9, symbol: 'circle' },
            showlegend: true
        });
        traceIdx++;
    });

    // ── Step 2: OCC Smooth Curve ─────────────────────────────────────
    await animateStep(2, "Drawing the smooth <b>OCC curve</b> through the data points. Note how it saturates at higher field currents — the iron core saturates.", async () => {
        await animateCurve('emfGraph', data.occIf, data.occVoc, {
            name: 'OCC Curve',
            line: { color: '#3b82f6', width: 2.5 },
            showlegend: true
        }, traceIdx);
        traceIdx++;
    });

    // ── Step 3: Plot SCC Points ──────────────────────────────────────
    await animateStep(3, "Plotting <b>Short Circuit Characteristic (SCC)</b> test data points on the secondary Y-axis. The machine is short-circuited and field current varied.", () => {
        Plotly.addTraces('emfGraph', {
            x: data.sccIf, y: data.sccIsc,
            mode: 'markers', name: 'SCC Data Points',
            yaxis: 'y2',
            marker: { color: '#10b981', size: 9, symbol: 'circle' },
            showlegend: true
        });
        traceIdx++;
    });

    // ── Step 4: SCC Line ─────────────────────────────────────────────
    await animateStep(4, "Drawing the <b>SCC line</b>. It is a straight line through the origin — the machine behaves linearly under short circuit because the unsaturated reactance dominates.", async () => {
        const slope = data.sccIsc[data.sccIsc.length - 1] / data.sccIf[data.sccIf.length - 1];
        const endIf = data.occIf[data.occIf.length - 1];
        await animateLine('emfGraph', 0, 0, endIf, slope * endIf, {
            name: 'SCC Line',
            yaxis: 'y2',
            line: { color: '#10b981', dash: 'dash', width: 2 },
            showlegend: true
        }, traceIdx);
        traceIdx++;
        calcResults.sccSlope = slope;
    });

    // ── Step 5: Air Gap Line ─────────────────────────────────────────
    await animateStep(5, "Drawing the <b>Air Gap Line</b> — a straight line tangent to the initial linear portion of the OCC. It represents the ideal unsaturated machine.", async () => {
        const slope = data.occVoc[1] / data.occIf[1];
        calcResults.airGapSlope = slope;
        const endIf = data.occIf[data.occIf.length - 1];
        await animateLine('emfGraph', 0, 0, endIf, slope * endIf, {
            name: 'Air Gap Line',
            line: { color: '#f59e0b', dash: 'dot', width: 2 },
            showlegend: true
        }, traceIdx);
        traceIdx++;
    });

    // ── Step 6: Zs Determination at rated voltage ─────────────────────
    await animateStep(6, "Determining <b>Synchronous Impedance Zs</b> from the OCC and SCC curves. Standard method: use the OCC point closest to rated voltage for the most accurate Zs (accounts for magnetic saturation).", async () => {
        const lookupIdx = findBestZsIndex(data.occVoc, data.sccIsc, data.ratedV);
        const If_val = data.occIf[lookupIdx];
        const Voc_line = data.occVoc[lookupIdx];
        const Voc_phase = Voc_line / Math.sqrt(3);
        const Isc_val = data.sccIsc[Math.min(lookupIdx, data.sccIsc.length - 1)];

        calcResults.Zs = Voc_phase / Isc_val;
        calcResults.Xs = Math.sqrt(Math.pow(calcResults.Zs, 2) - Math.pow(data.ra, 2));
        calcResults.lookupIf = If_val;
        calcResults.lookupVoc = Voc_line;
        calcResults.lookupIsc = Isc_val;

        // Vertical lookup line (hidden from legend)
        await animateLine('emfGraph', If_val, 0, If_val, Voc_line, {
            name: `If lookup`,
            line: { color: '#f59e0b', dash: 'dot', width: 1.5 },
            showlegend: false
        }, traceIdx);
        traceIdx++;

        // Horizontal to OCC y-axis
        await animateLine('emfGraph', If_val, Voc_line, 0, Voc_line, {
            name: `Voc lookup`,
            line: { color: '#3b82f6', dash: 'dot', width: 1.5 },
            showlegend: false
        }, traceIdx);
        traceIdx++;

        // Horizontal to SCC y2-axis
        await animateLine('emfGraph', If_val, Isc_val, 0, Isc_val, {
            name: `Isc lookup`,
            yaxis: 'y2',
            line: { color: '#10b981', dash: 'dot', width: 1.5 },
            showlegend: false
        }, traceIdx);
        traceIdx++;

        // Mark OCC lookup point
        Plotly.addTraces('emfGraph', {
            x: [If_val], y: [Voc_line],
            mode: 'markers+text', name: `Voc = ${Voc_line.toFixed(0)}V`,
            text: [`  Voc=${Voc_line.toFixed(0)}V`],
            textposition: 'middle right',
            textfont: { color: '#3b82f6', size: 11 },
            marker: { color: '#3b82f6', size: 10, symbol: 'diamond' },
            showlegend: false
        });
        traceIdx++;

        // Mark SCC lookup point
        Plotly.addTraces('emfGraph', {
            x: [If_val], y: [Isc_val],
            mode: 'markers+text', name: `Isc = ${Isc_val.toFixed(1)}A`,
            text: [`  Isc=${Isc_val.toFixed(1)}A`],
            textposition: 'middle right',
            textfont: { color: '#10b981', size: 11 },
            yaxis: 'y2',
            marker: { color: '#10b981', size: 10, symbol: 'diamond' },
            showlegend: false
        });
        traceIdx++;
    });

    // ── Step 7: E0 Calculation and E0→OCC Lookup ─────────────────────
    await animateStep(7, "Calculating <b>Generated EMF E0</b> using phasor addition: E0 = √[(V·cosφ + I·Ra)² + (V·sinφ ± I·Xs)²]. Then we find the required field current If_E0 from the OCC at this E0.", async () => {
        const V = data.ratedV / Math.sqrt(3); // phase
        const I = data.ratedI;
        const phi = Math.acos(data.pf);
        const sign = data.pfType === 'leading' ? -1 : 1;
        const Xs = calcResults.Xs;
        const Ra = data.ra;

        const E0 = Math.sqrt(
            Math.pow(V * data.pf + I * Ra, 2) +
            Math.pow(V * Math.sin(phi) + sign * I * Xs, 2)
        );
        const E0_line = E0 * Math.sqrt(3);
        const reg = ((E0 - V) / V) * 100;

        calcResults.E0 = E0;
        calcResults.E0_line = E0_line;
        calcResults.reg = reg;
        calcResults.V_phase = V;
        calcResults.phi = phi;
        calcResults.I = I;
        calcResults.Ra = Ra;
        calcResults.Xs = Xs;

        // Find If_E0 from OCC at E0_line
        const If_E0 = interpolateYtoX(data.occIf, data.occVoc, E0_line);
        calcResults.If_E0 = If_E0;

        // Draw horizontal E0 line across the plot
        const maxIf = data.occIf[data.occIf.length - 1];
        await animateLine('emfGraph', 0, E0_line, maxIf, E0_line, {
            name: `E0 = ${E0_line.toFixed(1)} V (Line)`,
            line: { color: '#a855f7', dash: 'dot', width: 2 },
            showlegend: true
        }, traceIdx);
        traceIdx++;

        // Mark E0 on y-axis
        Plotly.addTraces('emfGraph', {
            x: [0], y: [E0_line],
            mode: 'markers+text', name: 'E0',
            text: [`E0 = ${E0_line.toFixed(1)} V`],
            textposition: 'middle right',
            textfont: { color: '#a855f7', size: 12 },
            marker: { color: '#a855f7', size: 10, symbol: 'circle' },
            showlegend: false
        });
        traceIdx++;

        // Draw vertical line from x-axis up to OCC at If_E0
        await animateLine('emfGraph', If_E0, 0, If_E0, E0_line, {
            name: `If_E0`,
            line: { color: '#a855f7', dash: 'dot', width: 2 },
            showlegend: false
        }, traceIdx);
        traceIdx++;

        // Mark OCC point at E0 — S point
        Plotly.addTraces('emfGraph', {
            x: [If_E0], y: [E0_line],
            mode: 'markers+text', name: `If_E0 = ${If_E0.toFixed(2)} A`,
            text: [`  If_E0 = ${If_E0.toFixed(2)} A`],
            textposition: 'middle right',
            textfont: { color: '#a855f7', size: 11 },
            marker: { color: '#a855f7', size: 12, symbol: 'star' },
            showlegend: true
        });
        traceIdx++;

        // ── Show Phasor Diagram ──
        document.getElementById('phasorCard').style.display = 'block';
        drawPhasorDiagram(V, I, Ra, Xs, data.pf, data.pfType);

        // ── Show Results Card ──
        const phiDeg = (phi * 180 / Math.PI).toFixed(2);
        const Zbase = V / I;
        const Xs_pu = Xs / Zbase;
        const Zs_pu = calcResults.Zs / Zbase;
        const E0_pu = E0 / V;
        const reg_pu = (E0 - V) / V;

        document.getElementById('resultsCard').style.display = 'block';

        // Main results table
        document.getElementById('calculationsText').innerHTML = `
            <strong>Phase Voltage (V):</strong> ${V.toFixed(2)} V&nbsp;&nbsp;
            <span style="color:var(--text-muted);font-size:0.85rem;">(= ${data.ratedV} / √3)</span><br>
            <strong>If lookup at:</strong> If = ${calcResults.lookupIf.toFixed(2)} A
            &nbsp;<span style="color:var(--text-muted);font-size:0.85rem;">(≈ rated voltage)</span><br>
            <strong>Synchronous Impedance (Zs):</strong> ${calcResults.Zs.toFixed(4)} Ω/ph<br>
            <strong>Armature Resistance (Ra):</strong> ${Ra.toFixed(4)} Ω/ph<br>
            <strong>Synchronous Reactance (Xs):</strong> ${Xs.toFixed(4)} Ω/ph<br>
            <hr style="border-color:var(--border);margin:8px 0;">
            <strong>Generated EMF (E0, phase):</strong> ${E0.toFixed(2)} V/ph<br>
            <strong>Generated EMF (E0, line):</strong> ${E0_line.toFixed(2)} V<br>
            <strong>Field Current at E0 (If_E0):</strong> <span style="color:#a855f7;">${If_E0.toFixed(3)} A</span><br>
        `;

        // Formula panel
        const plusMinus = data.pfType === 'leading' ? '−' : '+';
        document.getElementById('formulaText').innerHTML =
            `E0 = √[ (V·cosφ + I·Ra)² + (V·sinφ ${plusMinus} I·Xs)² ]<br>` +
            `   = √[ (${V.toFixed(2)}×${data.pf} + ${I.toFixed(2)}×${Ra.toFixed(2)})² + (${V.toFixed(2)}×sin${phiDeg}° ${plusMinus} ${I.toFixed(2)}×${Xs.toFixed(2)})² ]<br>` +
            `   = √[ ${(V * data.pf + I * Ra).toFixed(2)}² + ${(V * Math.sin(phi) + sign * I * Xs).toFixed(2)}² ]<br>` +
            `   = <strong style="color:#a855f7;">${E0.toFixed(2)} V/ph</strong>  (line: ${E0_line.toFixed(2)} V)<br><br>` +
            `VR = (E0 − V) / V × 100 = (${E0.toFixed(2)} − ${V.toFixed(2)}) / ${V.toFixed(2)} × 100 = <strong style="color:var(--primary);">${reg.toFixed(2)}%</strong>`;

        // Per-unit values
        document.getElementById('puText').innerHTML = `
            <span><strong>Zbase:</strong> ${Zbase.toFixed(3)} Ω</span>
            <span><strong>Zs (p.u.):</strong> ${Zs_pu.toFixed(4)}</span>
            <span><strong>Xs (p.u.):</strong> ${Xs_pu.toFixed(4)}</span>
            <span><strong>E0 (p.u.):</strong> ${E0_pu.toFixed(4)}</span>
            <span><strong>VR (p.u.):</strong> ${reg_pu.toFixed(4)}</span>
            <span><strong>Ra (p.u.):</strong> ${(Ra / Zbase).toFixed(4)}</span>
        `;

        // Draw regulation gauge
        drawRegulationGauge(reg);

        showToast('Animation Complete! ✓', 'success');
        updateStatusLED('ready');
        document.getElementById('btnStart').disabled = false;
    });
}

// ─── Reset ─────────────────────────────────────────────────────────
function resetGraph() {
    animationCancelled = true;
    isPaused = false;
    document.getElementById('btnStart').disabled = false;
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('phasorCard').style.display = 'none';
    document.getElementById('explanationText').innerHTML =
        "Welcome to the EMF Method simulation. Enter the experimental data on the left and click 'Start Animation' to begin.";
    updateStatusLED('ready');
    initGraph();
}

// ─── Download Report ───────────────────────────────────────────────
function generateReport() {
    let data;
    try { data = parseInput(); } catch (e) { showToast('Cannot generate report: ' + e.message, 'error'); return; }

    const phi = Math.acos(data.pf);
    const phiDeg = (phi * 180 / Math.PI).toFixed(2);
    const V = calcResults.V_phase;
    const Zbase = V / data.ratedI;

    let csv = "EMF Method (Synchronous Impedance Method) — Lab Report\n\n";
    csv += "=== Machine Parameters ===\n";
    csv += `Rated Line Voltage,${data.ratedV} V\n`;
    csv += `Rated Phase Voltage,${V ? V.toFixed(2) : '-'} V\n`;
    csv += `Rated Current,${data.ratedI} A\n`;
    csv += `Armature Resistance (Ra),${data.ra} Ω/ph\n`;
    csv += `Power Factor,${data.pf} (${data.pfType})\n`;
    csv += `Power Factor Angle (φ),${phiDeg}°\n\n`;

    csv += "=== Zs Determination ===\n";
    csv += `Lookup Field Current (If),${calcResults.lookupIf ? calcResults.lookupIf.toFixed(3) : '-'} A\n`;
    csv += `OCC Voltage at lookup,${calcResults.lookupVoc ? calcResults.lookupVoc.toFixed(2) : '-'} V (line)\n`;
    csv += `SCC Current at lookup,${calcResults.lookupIsc ? calcResults.lookupIsc.toFixed(3) : '-'} A\n`;
    csv += `Synchronous Impedance (Zs),${calcResults.Zs ? calcResults.Zs.toFixed(4) : '-'} Ω/ph\n`;
    csv += `Synchronous Reactance (Xs),${calcResults.Xs ? calcResults.Xs.toFixed(4) : '-'} Ω/ph\n\n`;

    csv += "=== EMF & Regulation Results ===\n";
    csv += `Generated EMF E0 (phase),${calcResults.E0 ? calcResults.E0.toFixed(4) : '-'} V/ph\n`;
    csv += `Generated EMF E0 (line),${calcResults.E0_line ? calcResults.E0_line.toFixed(4) : '-'} V\n`;
    csv += `Field Current for E0 (If_E0),${calcResults.If_E0 ? calcResults.If_E0.toFixed(4) : '-'} A\n`;
    csv += `Voltage Regulation,${calcResults.reg ? calcResults.reg.toFixed(4) : '-'} %\n\n`;

    csv += "=== Per-Unit Values ===\n";
    csv += `Base Impedance (Zbase),${Zbase.toFixed(4)} Ω\n`;
    csv += `Zs (p.u.),${calcResults.Zs ? (calcResults.Zs / Zbase).toFixed(4) : '-'}\n`;
    csv += `Xs (p.u.),${calcResults.Xs ? (calcResults.Xs / Zbase).toFixed(4) : '-'}\n`;
    csv += `Ra (p.u.),${data.ra ? (data.ra / Zbase).toFixed(4) : '-'}\n`;
    csv += `E0 (p.u.),${(calcResults.E0 && V) ? (calcResults.E0 / V).toFixed(4) : '-'}\n`;
    csv += `VR (p.u.),${calcResults.reg ? (calcResults.reg / 100).toFixed(4) : '-'}\n`;

    downloadCSV('EMF_Lab_Report.csv', csv);
}
