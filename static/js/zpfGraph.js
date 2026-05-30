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
        title: { 
            text: 'ZPF (Potier Triangle) Method', 
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
            title: { text: 'Voltage (V)', font: { family: 'Inter, sans-serif', size: 11 } }, 
            color: 'var(--text-muted)', 
            gridcolor: 'rgba(59, 130, 246, 0.08)',
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
        margin: { l: 60, r: 60, t: 50, b: 50 },
        shapes: [],
        annotations: []
    };

    Plotly.newPlot('zpfGraph', [], zpfLayout, {responsive: true, displayModeBar: false});
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
        `;
        
        // Calculate equivalent Xs for closing the voltage phasor diagram:
        let Xs = 0;
        const radicand = Math.pow(E0_phase, 2) - Math.pow(V * data.pf + I * data.ra, 2);
        if (radicand >= 0) {
            Xs = (-pfSign * V * Math.sin(phi) + Math.sqrt(radicand)) / I;
        } else {
            // Fallback: estimate from Potier leakage reactance Xl
            Xs = Xl || 0;
            console.warn("ZPF Synchronous Reactance Xs calculation hit negative radicand. Falling back to Xl:", Xs);
        }
        if (isNaN(Xs)) {
            Xs = Xl || 0;
        }

        // Draw the regulation gauge and phasor diagram
        drawRegulationGauge(reg);
        document.getElementById('phasorCard').style.display = 'block';
        drawPhasorDiagram(V, I, data.ra, Xs, data.pf, data.pfType);

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
    document.getElementById('phasorCard').style.display = 'none';
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
    
    downloadPDF('ZPF_Potier_Lab_Report.pdf', csv);
}

// ─── SVG Regulation Gauge ──────────────────────────────────────────
function drawRegulationGauge(regPercent) {
    const svg = document.getElementById('regGauge');
    if (!svg) return;
    const maxReg = 100;
    const clampedReg = Math.min(Math.max(regPercent, 0), maxReg);
    const fraction = clampedReg / maxReg;

    const cx = 100, cy = 100, r = 75;
    const startAngle = Math.PI;
    const endAngle = 0;

    function arcPath(fromFrac, toFrac, color) {
        const ang1 = Math.PI - fromFrac * Math.PI;
        const ang2 = Math.PI - toFrac * Math.PI;
        const x1 = cx + r * Math.cos(ang1), y1 = cy - r * Math.sin(ang1);
        const x2 = cx + r * Math.cos(ang2), y2 = cy - r * Math.sin(ang2);
        const largeArc = (toFrac - fromFrac) > 0.5 ? 1 : 0;
        return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>`;
    }

    const bgX1 = cx + r * Math.cos(Math.PI), bgY1 = cy - r * Math.sin(Math.PI);
    const bgX2 = cx + r * Math.cos(0), bgY2 = cy - r * Math.sin(0);
    const bgArc = `<path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 0 1 ${bgX2} ${bgY2}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14"/>`;

    const greenArc = arcPath(0, 0.20, '#10b981');
    const amberArc = arcPath(0.20, 0.40, '#f59e0b');
    const redArc   = arcPath(0.40, 1.0, '#ef4444');

    const needleX = cx + (r - 10) * Math.cos(Math.PI - fraction * Math.PI);
    const needleY = cy - (r - 10) * Math.sin(Math.PI - fraction * Math.PI);
    const needle = `<line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${regPercent > 40 ? '#ef4444' : regPercent > 20 ? '#f59e0b' : '#10b981'}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--text-muted)"/>`;

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

// ─── ZPF Voltage Phasor Canvas Drawing ──────────────────────────────
function drawPhasorDiagram(V, I, Ra, Xs, pf, pfType) {
    const canvas = document.getElementById('phasorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const phi = Math.acos(pf);
    const sign = pfType === 'leading' ? -1 : 1;

    const V_ph = V;
    const IRa = I * Ra;
    const IXs = I * Xs;
    const E0 = Math.sqrt(Math.pow(V_ph * pf + IRa, 2) + Math.pow(V_ph * Math.sin(phi) + sign * IXs, 2));

    const maxLen = E0 * 1.15;
    const scale = (Math.min(W, H) * 0.38) / maxLen;

    const cx = W * 0.2, cy = H * 0.55;

    const V_angle = sign >= 1 ? phi : -phi;

    const Vx = V_ph * Math.cos(V_angle) * scale;
    const Vy = -V_ph * Math.sin(V_angle) * scale;

    const IRax = IRa * scale;
    const Vend_x = cx + Vx;
    const Vend_y = cy + Vy;

    const pIRa_x = Vend_x + IRax;
    const pIRa_y = Vend_y;
    const pIXs_x = pIRa_x;
    const pIXs_y = pIRa_y - sign * IXs * scale;

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

    // Right angle marker
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
        <span style="color:#ef4444"><i class="fa-solid fa-minus"></i> I·Xs Drop (Equivalent)</span>
        <span style="color:#a855f7"><i class="fa-solid fa-minus" style="text-decoration:underline dotted"></i> E0 (Generated EMF)</span>
        <span style="color:rgba(255,255,255,0.35)">--- I (Current Reference)</span>
    `;
}
