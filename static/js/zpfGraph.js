let zpfPlotData = [];
let zpfLayout = {};
let isPaused = false;
let baseSpeed = 1000;
let calcResults = {};
let currentInputMode = 'manual';
let csvData = null;
let animationCancelled = false;

function initZpfGraph() {
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
    document.getElementById('zpfCsvFileInput').addEventListener('change', handleZpfCSVUpload);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZpfGraph);
} else {
    initZpfGraph();
}

function setInputMode(mode) {
    currentInputMode = mode;
    if(mode === 'manual') {
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

function handleOccCSVUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) throw new Error("Empty file");
            
            const occIf = [], occVoc = [];
            const zpfIf = [], zpfV = [];
            
            let startRow = 0;
            const firstLineCols = lines[0].split(',');
            if (firstLineCols.some(c => isNaN(parseFloat(c.trim())))) {
                startRow = 1;
            }
            
            let hasCombinedData = false;
            for(let i = startRow; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => parseFloat(c.trim()));
                if(cols.length >= 2 && !isNaN(cols[0]) && !isNaN(cols[1])) {
                    occIf.push(cols[0]);
                    occVoc.push(cols[1]);
                }
                if(cols.length >= 4 && !isNaN(cols[2]) && !isNaN(cols[3])) {
                    zpfIf.push(cols[2]);
                    zpfV.push(cols[3]);
                    hasCombinedData = true;
                }
            }
            
            if (occIf.length === 0) throw new Error("No numeric data found.");
            
            if(!csvData) csvData = { occIf: [], occVoc: [], zpfIf: [], zpfV: [] };
            csvData.occIf = occIf;
            csvData.occVoc = occVoc;
            
            const statusEl = document.getElementById('occCsvStatus');
            statusEl.style.display = 'block';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> OCC data loaded (${occIf.length} rows)`;
            
            if (hasCombinedData) {
                csvData.zpfIf = zpfIf;
                csvData.zpfV = zpfV;
                const zpfStatusEl = document.getElementById('zpfCsvStatus');
                zpfStatusEl.style.display = 'block';
                zpfStatusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ZPF data loaded (${zpfIf.length} rows) [Combined File]`;
                showToast('Combined OCC/ZPF CSV Loaded!', 'success');
            } else {
                showToast('OCC CSV Loaded Successfully!', 'success');
            }
        } catch (error) {
            showToast('Failed to parse OCC CSV: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function handleZpfCSVUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) throw new Error("Empty file");
            
            const zpfIf = [], zpfV = [];
            
            let startRow = 0;
            const firstLineCols = lines[0].split(',');
            if (firstLineCols.some(c => isNaN(parseFloat(c.trim())))) {
                startRow = 1;
            }
            
            for(let i = startRow; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => parseFloat(c.trim()));
                if(cols.length >= 2 && !isNaN(cols[0]) && !isNaN(cols[1])) {
                    zpfIf.push(cols[0]);
                    zpfV.push(cols[1]);
                }
            }
            
            if (zpfIf.length === 0) throw new Error("No numeric data found.");
            
            if(!csvData) csvData = { occIf: [], occVoc: [], zpfIf: [], zpfV: [] };
            csvData.zpfIf = zpfIf;
            csvData.zpfV = zpfV;
            
            const statusEl = document.getElementById('zpfCsvStatus');
            statusEl.style.display = 'block';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ZPF data loaded (${zpfIf.length} rows)`;
            
            showToast('ZPF CSV Loaded Successfully!', 'success');
        } catch (error) {
            showToast('Failed to parse ZPF CSV: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function initGraph() {
    zpfLayout = {
        title: { text: 'ZPF (Potier Triangle) Method', font: { color: 'var(--text-main)' } },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'Field Current (If) A', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
        yaxis: { title: 'Voltage (V)', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
        legend: { font: { color: 'var(--text-main)' } },
        margin: { l: 60, r: 60, t: 50, b: 50 },
        shapes: [],
        annotations: []
    };

    Plotly.newPlot('zpfGraph', [], zpfLayout, {responsive: true});
}

function parseInput() {
    let occIf, occVoc, zpfIf, zpfV;
    
    if(currentInputMode === 'manual') {
        occIf = document.getElementById('occIf').value.split(',').filter(x => x.trim() !== '').map(Number);
        occVoc = document.getElementById('occVoc').value.split(',').filter(x => x.trim() !== '').map(Number);
        zpfIf = document.getElementById('zpfIf').value.split(',').filter(x => x.trim() !== '').map(Number);
        zpfV = document.getElementById('zpfV').value.split(',').filter(x => x.trim() !== '').map(Number);
    } else {
        if(!csvData) {
            throw new Error('Please upload a CSV file first');
        }
        occIf = csvData.occIf;
        occVoc = csvData.occVoc;
        zpfIf = csvData.zpfIf;
        zpfV = csvData.zpfV;
    }
    
    const ratedV = parseFloat(document.getElementById('ratedV').value);
    const ratedI = parseFloat(document.getElementById('ratedI').value);
    const ra = parseFloat(document.getElementById('ra').value);
    const pf = parseFloat(document.getElementById('pf').value);
    const pfType = document.getElementById('pfType').value;

    return { occIf, occVoc, zpfIf, zpfV, ratedV, ratedI, ra, pf, pfType };
}

// ─── Cubic Spline (Catmull-Rom) Interpolation ───
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
            const p1 = seg;
            const p2 = seg + 1;
            const p3 = seg + 2 < n ? seg + 2 : seg + 1;
            
            const t2 = t * t;
            const t3 = t2 * t;
            
            const y = 0.5 * (
                (2 * yData[p1]) +
                (-yData[p0] + yData[p2]) * t +
                (2 * yData[p0] - 5 * yData[p1] + 4 * yData[p2] - yData[p3]) * t2 +
                (-yData[p0] + 3 * yData[p1] - 3 * yData[p2] + yData[p3]) * t3
            );
            
            xOut.push(x);
            yOut.push(y);
        }
    }
    xOut.push(xData[n - 1]);
    yOut.push(yData[n - 1]);
    
    return { x: xOut, y: yOut };
}

// ─── Interpolate: find x for a given y target ───
function interpolateYtoX(xArr, yArr, yTarget) {
    for (let i = 0; i < yArr.length - 1; i++) {
        if ((yTarget >= yArr[i] && yTarget <= yArr[i + 1]) || (yTarget <= yArr[i] && yTarget >= yArr[i + 1])) {
            const slope = (xArr[i + 1] - xArr[i]) / (yArr[i + 1] - yArr[i]);
            return xArr[i] + slope * (yTarget - yArr[i]);
        }
    }
    const n = xArr.length;
    const slope = (xArr[n-1] - xArr[n-2]) / (yArr[n-1] - yArr[n-2]);
    return xArr[n-1] + slope * (yTarget - yArr[n-1]);
}

// ─── Interpolate: find y for a given x target ───
function interpolateXtoY(xArr, yArr, xTarget) {
    for (let i = 0; i < xArr.length - 1; i++) {
        if (xTarget >= xArr[i] && xTarget <= xArr[i + 1]) {
            const slope = (yArr[i + 1] - yArr[i]) / (xArr[i + 1] - xArr[i]);
            return yArr[i] + slope * (xTarget - xArr[i]);
        }
    }
    const n = xArr.length;
    const slope = (yArr[n-1] - yArr[n-2]) / (xArr[n-1] - xArr[n-2]);
    return yArr[n-1] + slope * (xTarget - xArr[n-1]);
}

// ─── Find intersection of a line (from point with given slope) with OCC ───
// Line: y = y0 + slope * (x - x0)
// We check against dense OCC points for a sign-change crossing
function findLineOCCIntersection(x0, y0, slope, occIf, occVoc) {
    // Generate dense OCC points for accurate intersection
    const occ = cubicSplineInterpolate(occIf, occVoc, 500);
    
    // Look for sign change in (yLine - yOCC) — that's a true crossing
    let bestPt = null;
    
    for (let i = 0; i < occ.x.length - 1; i++) {
        const yLine_i = y0 + slope * (occ.x[i] - x0);
        const yLine_i1 = y0 + slope * (occ.x[i + 1] - x0);
        const diff_i = yLine_i - occ.y[i];
        const diff_i1 = yLine_i1 - occ.y[i + 1];
        
        // Sign change means the line crosses OCC between these two points
        if (diff_i * diff_i1 <= 0) {
            // Linear interpolation to find exact crossing
            const t = Math.abs(diff_i) / (Math.abs(diff_i) + Math.abs(diff_i1));
            const xCross = occ.x[i] + t * (occ.x[i + 1] - occ.x[i]);
            const yCross = occ.y[i] + t * (occ.y[i + 1] - occ.y[i]);
            bestPt = { x: xCross, y: yCross };
            // Take the last crossing (closest to the saturated region)
        }
    }
    
    if (bestPt) return bestPt;
    
    // Fallback: find the closest approach point (no sign change found)
    let bestDist = Infinity;
    for (let i = 0; i < occ.x.length; i++) {
        const yLine = y0 + slope * (occ.x[i] - x0);
        const diff = Math.abs(yLine - occ.y[i]);
        if (diff < bestDist) {
            bestDist = diff;
            bestPt = { x: occ.x[i], y: occ.y[i] };
        }
    }
    
    return bestPt || { x: x0, y: y0 };
}

// ─── Smooth Curve Drawing Animation ───
function animateCurve(graphId, xData, yData, traceOptions, traceIndex) {
    return new Promise(resolve => {
        const interp = cubicSplineInterpolate(xData, yData, 150);
        const totalPts = interp.x.length;
        let drawn = 1;
        const batchSize = 2;
        
        const trace = Object.assign({ x: [interp.x[0]], y: [interp.y[0]], mode: 'lines' }, traceOptions);
        Plotly.addTraces(graphId, trace);
        
        function drawNext() {
            if (animationCancelled) { resolve(); return; }
            if (isPaused) { requestAnimationFrame(drawNext); return; }
            
            const end = Math.min(drawn + batchSize, totalPts);
            const xBatch = interp.x.slice(drawn, end);
            const yBatch = interp.y.slice(drawn, end);
            drawn = end;
            
            Plotly.extendTraces(graphId, { x: [xBatch], y: [yBatch] }, [traceIndex]);
            
            if (drawn < totalPts) {
                const delay = Math.max(5, baseSpeed / 100);
                setTimeout(() => requestAnimationFrame(drawNext), delay);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(drawNext);
    });
}

// ─── Animate a straight line smoothly ───
function animateLine(graphId, x0, y0, x1, y1, traceOptions, traceIndex) {
    return new Promise(resolve => {
        const steps = 40;
        let drawn = 1;
        
        const trace = Object.assign({ x: [x0], y: [y0], mode: 'lines' }, traceOptions);
        Plotly.addTraces(graphId, trace);
        
        function drawNext() {
            if (animationCancelled) { resolve(); return; }
            if (isPaused) { requestAnimationFrame(drawNext); return; }
            
            drawn++;
            const t = drawn / steps;
            const xPt = x0 + t * (x1 - x0);
            const yPt = y0 + t * (y1 - y0);
            
            Plotly.extendTraces(graphId, { x: [[xPt]], y: [[yPt]] }, [traceIndex]);
            
            if (drawn < steps) {
                const delay = Math.max(5, baseSpeed / steps);
                setTimeout(() => requestAnimationFrame(drawNext), delay);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(drawNext);
    });
}

// ─── Animate a set of pre-calculated points smoothly ───
function animatePoints(graphId, xPts, yPts, traceOptions, traceIndex) {
    return new Promise(resolve => {
        const totalPts = xPts.length;
        let drawn = 1;
        const batchSize = 1;
        
        const trace = Object.assign({ x: [xPts[0]], y: [yPts[0]], mode: 'lines' }, traceOptions);
        Plotly.addTraces(graphId, trace);
        
        function drawNext() {
            if (animationCancelled) { resolve(); return; }
            if (isPaused) { requestAnimationFrame(drawNext); return; }
            
            const end = Math.min(drawn + batchSize, totalPts);
            const xBatch = xPts.slice(drawn, end);
            const yBatch = yPts.slice(drawn, end);
            drawn = end;
            
            Plotly.extendTraces(graphId, { x: [xBatch], y: [yBatch] }, [traceIndex]);
            
            if (drawn < totalPts) {
                const delay = Math.max(5, baseSpeed / 60);
                setTimeout(() => requestAnimationFrame(drawNext), delay);
            } else {
                resolve();
            }
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
                Promise.resolve(action()).then(() => {
                    setTimeout(resolve, Math.max(200, baseSpeed / 3));
                });
            }
        }, 100);
    });
}

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
    updateStatusLED('running');
    document.getElementById('btnStart').disabled = true;
    
    let traceIdx = 0;

    // ─────── STEP 1: Plot OCC points and draw smooth curve ───────
    await animateStep(1, "Plotting OCC data points.", () => {
        Plotly.addTraces('zpfGraph', {
            x: data.occIf, y: data.occVoc,
            mode: 'markers', name: 'OCC Points',
            marker: { color: '#3b82f6', size: 8 }
        });
        traceIdx++;
    });

    await animateStep(2, "Drawing the smooth OCC curve through the data points.", async () => {
        await animateCurve('zpfGraph', data.occIf, data.occVoc, {
            name: 'OCC Curve',
            line: { color: '#3b82f6', width: 2.5 }
        }, traceIdx);
        traceIdx++;
    });

    // ─────── STEP 3: Plot ZPFC points and draw smooth curve ───────
    await animateStep(3, "Plotting ZPFC (Zero Power Factor Characteristic) data points.", () => {
        Plotly.addTraces('zpfGraph', {
            x: data.zpfIf, y: data.zpfV,
            mode: 'markers', name: 'ZPFC Points',
            marker: { color: '#10b981', size: 8 }
        });
        traceIdx++;
    });

    await animateStep(4, "Drawing the smooth ZPFC curve through the data points.", async () => {
        await animateCurve('zpfGraph', data.zpfIf, data.zpfV, {
            name: 'ZPFC Curve',
            line: { color: '#10b981', width: 2.5 }
        }, traceIdx);
        traceIdx++;
    });

    // ─────── STEP 5: Draw Air Gap Line ───────
    await animateStep(5, "Drawing the <b>Air Gap Line</b> — tangent to the initial linear portion of the OCC.", async () => {
        // Air gap line slope from origin through the first linear OCC point
        const airGapSlope = data.occVoc[1] / data.occIf[1];
        calcResults.airGapSlope = airGapSlope;
        
        const maxIf = Math.max(...data.occIf, ...data.zpfIf) * 1.1;
        
        await animateLine('zpfGraph', 0, 0, maxIf, airGapSlope * maxIf, {
            name: 'Air Gap Line',
            line: { color: '#f59e0b', dash: 'dot', width: 2 }
        }, traceIdx);
        traceIdx++;
    });

    // ─────── STEP 6: Locate Point P on ZPFC at rated voltage ───────
    await animateStep(6, "Locating point <b>P</b> on the ZPFC at rated terminal voltage V = " + data.ratedV + " V.", () => {
        const V_rated = data.ratedV;
        const If_P = interpolateYtoX(data.zpfIf, data.zpfV, V_rated);
        
        calcResults.P = { x: If_P, y: V_rated };
        
        // Mark point P
        Plotly.addTraces('zpfGraph', {
            x: [If_P], y: [V_rated],
            mode: 'markers+text', name: 'Point P',
            text: ['P'],
            textposition: 'top right',
            textfont: { color: '#ef4444', size: 14, family: 'Arial Black' },
            marker: { color: '#ef4444', size: 12, symbol: 'circle' }
        });
        traceIdx++;
    });

    // ─────── STEP 7: Locate Point A (SC field current) and draw PR horizontal ───────
    await animateStep(7, "Point <b>A</b> is the short-circuit point on ZPFC (V=0). The horizontal distance PA = If_sc = " + 
        data.zpfIf[0].toFixed(2) + " A. Drawing horizontal line from P to the left by If_sc to get point <b>R</b>.", async () => {
        
        // The first ZPFC point should be at V ≈ 0 (short circuit condition at rated current)
        // If_sc is the field current at V=0 on ZPFC
        const If_sc = data.zpfIf[0]; // field current at zero terminal voltage
        calcResults.If_sc = If_sc;
        
        const P = calcResults.P;
        const R = { x: P.x - If_sc, y: P.y };
        calcResults.R = R;
        
        // Draw horizontal line from P to R
        await animateLine('zpfGraph', P.x, P.y, R.x, R.y, {
            name: `PR (If_sc = ${If_sc.toFixed(2)} A)`,
            line: { color: '#ef4444', width: 2.5 }
        }, traceIdx);
        traceIdx++;
        
        // Mark point R
        Plotly.addTraces('zpfGraph', {
            x: [R.x], y: [R.y],
            mode: 'markers+text', name: 'Point R',
            text: ['R'],
            textposition: 'top left',
            textfont: { color: '#ef4444', size: 14, family: 'Arial Black' },
            marker: { color: '#ef4444', size: 12, symbol: 'circle' }
        });
        traceIdx++;
    });

    // ─────── STEP 8: Draw line from R parallel to Air Gap Line to intersect OCC at S ───────
    await animateStep(8, "Drawing a line from <b>R</b> parallel to the Air Gap Line until it intersects the OCC curve at point <b>S</b>. " +
        "This completes the <b>Potier Triangle PRS</b>.", async () => {
        
        const R = calcResults.R;
        const slope = calcResults.airGapSlope;
        
        // Find intersection point S of line from R (parallel to air gap) with OCC
        const S = findLineOCCIntersection(R.x, R.y, slope, data.occIf, data.occVoc);
        calcResults.S = S;
        
        // Draw line from R to S (and extend a bit past for visibility)
        await animateLine('zpfGraph', R.x, R.y, S.x, S.y, {
            name: 'RS (∥ Air Gap Line)',
            line: { color: '#f59e0b', width: 2.5, dash: 'dash' }
        }, traceIdx);
        traceIdx++;
        
        // Mark point S
        Plotly.addTraces('zpfGraph', {
            x: [S.x], y: [S.y],
            mode: 'markers+text', name: 'Point S',
            text: ['S'],
            textposition: 'bottom right',
            textfont: { color: '#a855f7', size: 14, family: 'Arial Black' },
            marker: { color: '#a855f7', size: 12, symbol: 'circle' }
        });
        traceIdx++;
        
        // Draw SP (vertical leg of Potier triangle — the leakage reactance drop)
        const P = calcResults.P;
        await animateLine('zpfGraph', S.x, S.y, P.x, P.y, {
            name: 'SP (Potier Drop)',
            line: { color: '#a855f7', width: 3 }
        }, traceIdx);
        traceIdx++;
    });

    // ─────── STEP 9: Extract Potier reactance and armature reaction field ───────
    await animateStep(9, "From the Potier Triangle: <b>SP</b> (vertical drop) = √3·Ia·XL gives the <b>Potier Reactance XL</b>. " +
        "The horizontal distance <b>RS projection</b> gives the field current for <b>armature reaction (Far)</b>.", () => {
        
        const P = calcResults.P;
        const R = calcResults.R;
        const S = calcResults.S;
        
        // Potier drop (vertical distance between S and P) — this is in line voltage
        const potierDropLine = Math.abs(S.y - P.y);
        // XL = potierDrop / (sqrt(3) * Ia)
        // But the drop SP is the voltage drop due to leakage reactance:
        // In the triangle, the vertical distance SP = √3 * Ia * Xl (if OCC is in line voltage)
        const Xl = potierDropLine / (Math.sqrt(3) * data.ratedI);
        
        // Armature reaction field current (horizontal distance between S and P on x-axis)
        // Actually: Far = horizontal projection = P.x - S.x
        // But more precisely, the Potier triangle gives:
        // PR = If_sc (total), and this splits into:
        // Far (armature reaction) = P.x - S.x (horizontal component from S to P)
        // The remaining R to S horizontal is the leakage component
        const Far = P.x - S.x; // field current equivalent of armature reaction
        
        calcResults.Xl = Xl;
        calcResults.Far = Far;
        calcResults.potierDropLine = potierDropLine;

        // --- ZPF Regulation Mathematical Calculations ---
        const V = data.ratedV / Math.sqrt(3); // phase voltage
        const I = data.ratedI;
        const phi = Math.acos(data.pf);
        const pfSign = data.pfType === 'leading' ? -1 : 1;
        
        // E1 phase voltage
        const E1 = Math.sqrt(Math.pow(V * data.pf + I * data.ra, 2) + Math.pow(V * Math.sin(phi) + pfSign * I * Xl, 2));
        const E1_line = E1 * Math.sqrt(3);
        
        // Find If1 from OCC at E1_line
        const If1 = interpolateYtoX(data.occIf, data.occVoc, E1_line);
        
        // Internal angle psi (angle of E1 relative to I)
        const psi = Math.atan2(V * Math.sin(phi) + pfSign * I * Xl, V * data.pf + I * data.ra);
        
        // Resultant field current Ifr
        const Ifr = Math.sqrt(Math.pow(If1 + Far * Math.sin(psi), 2) + Math.pow(Far * Math.cos(psi), 2));
        
        // Find E0_line from OCC at Ifr
        const E0_line = interpolateXtoY(data.occIf, data.occVoc, Ifr);
        const E0_phase = E0_line / Math.sqrt(3);
        
        // Voltage regulation
        const reg = ((E0_phase - V) / V) * 100;
        
        calcResults.E1 = E1;
        calcResults.If1 = If1;
        calcResults.psi = psi;
        calcResults.Ifr = Ifr;
        calcResults.E0_line = E0_line;
        calcResults.E0_phase = E0_phase;
        calcResults.reg = reg;
        
        // Add dimension annotations to the triangle
        // Annotate the Potier drop (SP)
        Plotly.addTraces('zpfGraph', {
            x: [P.x + 0.08, P.x + 0.08], y: [S.y, P.y],
            mode: 'lines+text', name: 'Potier Drop',
            text: ['', `ΔV = ${potierDropLine.toFixed(1)} V`],
            textposition: ['bottom center', 'middle right'],
            textfont: { color: '#a855f7', size: 11 },
            line: { color: '#a855f7', width: 1, dash: 'dot' },
            showlegend: false
        });
        traceIdx++;

        // Display Results
        const phiDeg = (phi * 180 / Math.PI).toFixed(1);
        document.getElementById('resultsCard').style.display = 'block';
        document.getElementById('calculationsText').innerHTML = `
            <strong>── Potier Triangle Results ──</strong><br>
            <strong>Point P:</strong> (${calcResults.P.x.toFixed(2)}, ${calcResults.P.y.toFixed(1)}) on ZPFC<br>
            <strong>Point R:</strong> (${calcResults.R.x.toFixed(2)}, ${calcResults.R.y.toFixed(1)})<br>
            <strong>Point S:</strong> (${calcResults.S.x.toFixed(2)}, ${calcResults.S.y.toFixed(1)}) on OCC<br>
            <strong>Short Circuit Field (If_sc):</strong> ${calcResults.If_sc.toFixed(2)} A<br>
            <strong>Potier Drop (SP):</strong> ${calcResults.potierDropLine.toFixed(1)} V (line)<br>
            <hr style="border-color: var(--border); margin: 8px 0;">
            <strong>Potier Reactance (Xl):</strong> ${calcResults.Xl.toFixed(3)} Ω/ph<br>
            <strong>Armature Reaction Field (Far):</strong> ${calcResults.Far.toFixed(3)} A<br>
            <hr style="border-color: var(--border); margin: 8px 0;">
            <strong>── Regulation Calculation ──</strong><br>
            <strong>Phase Voltage V:</strong> ${V.toFixed(2)} V<br>
            <strong>Power Factor Angle φ:</strong> ${phiDeg}°<br>
            <strong>E1 (phase, behind Xl):</strong> ${calcResults.E1.toFixed(2)} V<br>
            <strong>If1 (from OCC at E1):</strong> ${If1.toFixed(3)} A<br>
            <strong>Resultant Ifr:</strong> ${Ifr.toFixed(3)} A<br>
            <strong>E0 (Line):</strong> ${E0_line.toFixed(2)} V<br>
            <strong>E0 (Phase):</strong> ${E0_phase.toFixed(2)} V<br>
            <strong style="color: var(--primary); font-size: 1.2rem;">Voltage Regulation: ${reg.toFixed(2)} %</strong>
        `;
        
        showToast('Animation Complete!', 'success');
        updateStatusLED('ready');
        document.getElementById('btnStart').disabled = false;
    });
}

function resetGraph() {
    animationCancelled = true;
    isPaused = false;
    document.getElementById('btnStart').disabled = false;
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('explanationText').innerHTML = "Welcome to the ZPF (Potier Triangle) Method simulation. Enter data and start the animation.";
    updateStatusLED('ready');
    initGraph();
}

function generateReport() {
    const data = parseInput();
    let csv = "ZPF (Potier Triangle) Method Lab Report\n\n";
    csv += "Inputs:\n";
    csv += `Rated Voltage,${data.ratedV} V\n`;
    csv += `Rated Current,${data.ratedI} A\n`;
    csv += `Armature Resistance,${data.ra} Ohms\n`;
    csv += `Power Factor,${data.pf} ${data.pfType}\n\n`;
    csv += "Potier Triangle:\n";
    csv += `Point P (If; V),(${calcResults.P.x.toFixed(2)}; ${calcResults.P.y.toFixed(1)})\n`;
    csv += `Point R (If; V),(${calcResults.R.x.toFixed(2)}; ${calcResults.R.y.toFixed(1)})\n`;
    csv += `Point S (If; V),(${calcResults.S.x.toFixed(2)}; ${calcResults.S.y.toFixed(1)})\n`;
    csv += `Short Circuit Field (If_sc),${calcResults.If_sc.toFixed(2)} A\n`;
    csv += `Potier Reactance (Xl),${calcResults.Xl.toFixed(3)} Ohms/ph\n`;
    csv += `Armature Reaction Field (Far),${calcResults.Far.toFixed(3)} A\n\n`;
    csv += "Regulation:\n";
    csv += `E1 (Phase),${calcResults.E1.toFixed(2)} V\n`;
    csv += `If1,${calcResults.If1.toFixed(3)} A\n`;
    csv += `Resultant Ifr,${calcResults.Ifr.toFixed(3)} A\n`;
    csv += `E0 (Line),${calcResults.E0_line.toFixed(2)} V\n`;
    csv += `E0 (Phase),${calcResults.E0_phase.toFixed(2)} V\n`;
    csv += `Voltage Regulation,${calcResults.reg.toFixed(2)} %\n`;
    
    downloadCSV('ZPF_Potier_Lab_Report.csv', csv);
}
