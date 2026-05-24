let mmfPlotData = [];
let mmfLayout = {};
let isPaused = false;
let baseSpeed = 1000;
let calcResults = {};
let currentInputMode = 'manual';
let csvData = null;
let animationCancelled = false;

function initMmfGraph() {
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
    document.addEventListener('DOMContentLoaded', initMmfGraph);
} else {
    initMmfGraph();
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
            const sccIf = [], sccIsc = [];
            
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
                    sccIf.push(cols[2]);
                    sccIsc.push(cols[3]);
                    hasCombinedData = true;
                }
            }
            
            if (occIf.length === 0) throw new Error("No numeric data found.");
            
            if(!csvData) csvData = { occIf: [], occVoc: [], sccIf: [], sccIsc: [] };
            csvData.occIf = occIf;
            csvData.occVoc = occVoc;
            
            const statusEl = document.getElementById('occCsvStatus');
            statusEl.style.display = 'block';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> OCC data loaded (${occIf.length} rows)`;
            
            if (hasCombinedData) {
                csvData.sccIf = sccIf;
                csvData.sccIsc = sccIsc;
                const sccStatusEl = document.getElementById('sccCsvStatus');
                sccStatusEl.style.display = 'block';
                sccStatusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> SCC data loaded (${sccIf.length} rows) [Combined File]`;
                showToast('Combined OCC/SCC CSV Loaded!', 'success');
            } else {
                showToast('OCC CSV Loaded Successfully!', 'success');
            }
        } catch (error) {
            showToast('Failed to parse OCC CSV: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function handleSccCSVUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) throw new Error("Empty file");
            
            const sccIf = [], sccIsc = [];
            
            let startRow = 0;
            const firstLineCols = lines[0].split(',');
            if (firstLineCols.some(c => isNaN(parseFloat(c.trim())))) {
                startRow = 1;
            }
            
            for(let i = startRow; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => parseFloat(c.trim()));
                if(cols.length >= 2 && !isNaN(cols[0]) && !isNaN(cols[1])) {
                    sccIf.push(cols[0]);
                    sccIsc.push(cols[1]);
                }
            }
            
            if (sccIf.length === 0) throw new Error("No numeric data found.");
            
            if(!csvData) csvData = { occIf: [], occVoc: [], sccIf: [], sccIsc: [] };
            csvData.sccIf = sccIf;
            csvData.sccIsc = sccIsc;
            
            const statusEl = document.getElementById('sccCsvStatus');
            statusEl.style.display = 'block';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> SCC data loaded (${sccIf.length} rows)`;
            
            showToast('SCC CSV Loaded Successfully!', 'success');
        } catch (error) {
            showToast('Failed to parse SCC CSV: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function initGraph() {
    mmfLayout = {
        title: { text: 'MMF Method Characteristics', font: { color: 'var(--text-main)' } },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'Field Current (If) A', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
        yaxis: { title: 'Voltage (V)', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
        yaxis2: {
            title: 'Current (A)',
            color: 'var(--accent)',
            overlaying: 'y',
            side: 'right',
            gridcolor: 'transparent'
        },
        legend: { font: { color: 'var(--text-main)' } },
        margin: { l: 60, r: 60, t: 50, b: 50 },
        shapes: [],
        annotations: []
    };

    Plotly.newPlot('mmfGraph', [], mmfLayout, {responsive: true});
}

function parseInput() {
    let occIf, occVoc, sccIf, sccIsc;
    
    if(currentInputMode === 'manual') {
        occIf = document.getElementById('occIf').value.split(',').filter(x => x.trim() !== '').map(Number);
        occVoc = document.getElementById('occVoc').value.split(',').filter(x => x.trim() !== '').map(Number);
        sccIf = document.getElementById('sccIf').value.split(',').filter(x => x.trim() !== '').map(Number);
        sccIsc = document.getElementById('sccIsc').value.split(',').filter(x => x.trim() !== '').map(Number);
    } else {
        if(!csvData) {
            throw new Error('Please upload a CSV file first');
        }
        occIf = csvData.occIf;
        occVoc = csvData.occVoc;
        sccIf = csvData.sccIf;
        sccIsc = csvData.sccIsc;
    }
    
    const ratedV = parseFloat(document.getElementById('ratedV').value);
    const ratedI = parseFloat(document.getElementById('ratedI').value);
    const pf = parseFloat(document.getElementById('pf').value);
    const pfType = document.getElementById('pfType').value;

    return { occIf, occVoc, sccIf, sccIsc, ratedV, ratedI, pf, pfType };
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

// ─── Interpolate: given x arrays and y arrays, find x for a given y target ───
function interpolateYtoX(xArr, yArr, yTarget) {
    for (let i = 0; i < yArr.length - 1; i++) {
        if ((yTarget >= yArr[i] && yTarget <= yArr[i + 1]) || (yTarget <= yArr[i] && yTarget >= yArr[i + 1])) {
            const slope = (xArr[i + 1] - xArr[i]) / (yArr[i + 1] - yArr[i]);
            return xArr[i] + slope * (yTarget - yArr[i]);
        }
    }
    // Extrapolate using last two points
    const n = xArr.length;
    const slope = (xArr[n-1] - xArr[n-2]) / (yArr[n-1] - yArr[n-2]);
    return xArr[n-1] + slope * (yTarget - yArr[n-1]);
}

// ─── Interpolate: given x arrays and y arrays, find y for a given x target ───
function interpolateXtoY(xArr, yArr, xTarget) {
    for (let i = 0; i < xArr.length - 1; i++) {
        if (xTarget >= xArr[i] && xTarget <= xArr[i + 1]) {
            const slope = (yArr[i + 1] - yArr[i]) / (xArr[i + 1] - xArr[i]);
            return yArr[i] + slope * (xTarget - xArr[i]);
        }
    }
    // Extrapolate using last two points
    const n = xArr.length;
    const slope = (yArr[n-1] - yArr[n-2]) / (xArr[n-1] - xArr[n-2]);
    return yArr[n-1] + slope * (xTarget - xArr[n-1]);
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

    // ─────── STEP 1: Plot OCC data points ───────
    await animateStep(1, "Plotting Open Circuit Characteristic (OCC) test data points.", () => {
        Plotly.addTraces('mmfGraph', {
            x: data.occIf, y: data.occVoc,
            mode: 'markers', name: 'OCC Points',
            marker: { color: '#3b82f6', size: 8 }
        });
        traceIdx++;
    });

    // ─────── STEP 2: Draw smooth OCC curve ───────
    await animateStep(2, "Drawing the smooth OCC curve through the data points.", async () => {
        await animateCurve('mmfGraph', data.occIf, data.occVoc, {
            name: 'OCC Curve',
            line: { color: '#3b82f6', width: 2.5 }
        }, traceIdx);
        traceIdx++;
    });

    // ─────── STEP 3: Plot SCC data points ───────
    await animateStep(3, "Plotting Short Circuit Characteristic (SCC) test data points.", () => {
        Plotly.addTraces('mmfGraph', {
            x: data.sccIf, y: data.sccIsc,
            mode: 'markers', name: 'SCC Points',
            yaxis: 'y2',
            marker: { color: '#10b981', size: 8 }
        });
        traceIdx++;
    });

    // ─────── STEP 4: Draw smooth SCC line ───────
    await animateStep(4, "Drawing the SCC line (straight line through origin).", async () => {
        const sccSlope = data.sccIsc[data.sccIsc.length-1] / data.sccIf[data.sccIf.length-1];
        const endIf = Math.max(...data.occIf, ...data.sccIf);
        
        await animateLine('mmfGraph', 0, 0, endIf, sccSlope * endIf, {
            name: 'SCC Line', yaxis: 'y2',
            line: { color: '#10b981', dash: 'dash', width: 2 }
        }, traceIdx);
        traceIdx++;
        
        calcResults.sccSlope = sccSlope;
    });

    // ─────── STEP 5: Find If1 — field current for rated voltage from OCC ───────
    await animateStep(5, "Finding <b>If1</b> — the field current corresponding to <b>rated voltage</b> from the OCC curve.", async () => {
        const V_rated = data.ratedV; // Line voltage
        const If1 = interpolateYtoX(data.occIf, data.occVoc, V_rated);
        calcResults.If1 = If1;
        calcResults.V_rated = V_rated;
        calcResults.V_phase = V_rated / Math.sqrt(3);
        
        // Draw horizontal dashed line from y-axis to OCC at rated V
        await animateLine('mmfGraph', 0, V_rated, If1, V_rated, {
            name: `V rated = ${V_rated} V`,
            line: { color: '#f59e0b', dash: 'dot', width: 1.5 }
        }, traceIdx);
        traceIdx++;
        
        // Draw vertical dashed line down to x-axis from If1
        await animateLine('mmfGraph', If1, V_rated, If1, 0, {
            name: `If1 = ${If1.toFixed(3)} A`,
            line: { color: '#f59e0b', dash: 'dot', width: 1.5 }
        }, traceIdx);
        traceIdx++;
        
        // Mark point on OCC
        Plotly.addTraces('mmfGraph', {
            x: [If1], y: [V_rated],
            mode: 'markers+text', name: 'If1 Point',
            text: [`If1 = ${If1.toFixed(2)} A`],
            textposition: 'top right',
            textfont: { color: '#f59e0b', size: 12 },
            marker: { color: '#f59e0b', size: 10, symbol: 'diamond' }
        });
        traceIdx++;
    });

    // ─────── STEP 6: Find If2 — field current for rated current from SCC ───────
    await animateStep(6, "Finding <b>If2</b> — the field current corresponding to <b>rated armature current</b> from the SCC line.", async () => {
        const Ia = data.ratedI;
        const If2 = Ia / calcResults.sccSlope;
        calcResults.If2 = If2;
        
        // Draw horizontal dashed line on SCC axis at rated current
        await animateLine('mmfGraph', 0, Ia, If2, Ia, {
            name: `Ia rated = ${Ia} A`,
            yaxis: 'y2',
            line: { color: '#ef4444', dash: 'dot', width: 1.5 }
        }, traceIdx);
        traceIdx++;
        
        // Draw vertical dashed line
        await animateLine('mmfGraph', If2, Ia, If2, 0, {
            name: `If2 = ${If2.toFixed(3)} A`,
            yaxis: 'y2',
            line: { color: '#ef4444', dash: 'dot', width: 1.5 }
        }, traceIdx);
        traceIdx++;
        
        // Mark point on SCC
        Plotly.addTraces('mmfGraph', {
            x: [If2], y: [Ia],
            mode: 'markers+text', name: 'If2 Point',
            text: [`If2 = ${If2.toFixed(2)} A`],
            textposition: 'top right',
            textfont: { color: '#ef4444', size: 12 },
            yaxis: 'y2',
            marker: { color: '#ef4444', size: 10, symbol: 'diamond' }
        });
        traceIdx++;
    });

    // ─────── STEP 7: Phasor addition — construct resultant If0 ───────
    await animateStep(7, "Constructing resultant field current <b>If0</b> using phasor addition of If1 and If2. " +
        "If2 is placed at angle <b>(90° + φ)</b> for lagging (or 90° − φ for leading) from If1. " +
        "We swing an arc of radius equal to the magnitude of If0 to project it onto the horizontal field current axis.", async () => {
        
        const If1 = calcResults.If1;
        const If2 = calcResults.If2;
        const phi = Math.acos(data.pf); // power factor angle in radians
        
        let angleBetween; 
        if (data.pfType === 'lagging') {
            angleBetween = (Math.PI / 2) + phi;
        } else if (data.pfType === 'leading') {
            angleBetween = (Math.PI / 2) - phi;
        } else {
            angleBetween = Math.PI / 2;
        }
        
        let If2_angle;
        if (data.pfType === 'lagging') {
            If2_angle = Math.PI - (Math.PI/2 + phi); // = π/2 - φ
        } else if (data.pfType === 'leading') {
            If2_angle = Math.PI - (Math.PI/2 - phi); // = π/2 + φ
        } else {
            If2_angle = Math.PI / 2;
        }
        
        const If2x = If2 * Math.cos(If2_angle);
        const If2y = If2 * Math.sin(If2_angle);
        
        const If0x = If1 + If2x;
        const If0y = If2y;
        const If0 = Math.sqrt(If0x * If0x + If0y * If0y);
        
        calcResults.If0 = If0;
        calcResults.angleBetween = angleBetween;
        calcResults.If2_angle = If2_angle;
        
        const yBase = data.ratedV * 0.15;
        const xBase = 0;
        const scale = data.ratedV / Math.max(If1, If0) * 0.5; 
        
        const pIf1_end_x = xBase + If1;
        const pIf1_end_y = yBase;
        
        const pIf2_end_x = pIf1_end_x + If2 * Math.cos(If2_angle) * (If1 / If1);
        const pIf2_end_y = yBase + If2 * Math.sin(If2_angle) * scale;
        
        const pIf0_end_x = If0x;
        const pIf0_end_y = yBase + If2y * scale;
        
        // Draw If1 vector smoothly
        await animateLine('mmfGraph', xBase, yBase, pIf1_end_x, pIf1_end_y, {
            name: `If1 = ${If1.toFixed(2)} A`,
            line: { color: '#3b82f6', width: 3 },
        }, traceIdx);
        // Add arrow marker to tip
        Plotly.addTraces('mmfGraph', {
            x: [pIf1_end_x], y: [pIf1_end_y],
            mode: 'markers', name: `If1 tip`,
            marker: { color: '#3b82f6', size: 10, symbol: 'triangle-right' },
            showlegend: false
        });
        traceIdx += 2;
        
        // Draw If2 vector smoothly
        await animateLine('mmfGraph', pIf1_end_x, pIf1_end_y, pIf0_end_x, pIf0_end_y, {
            name: `If2 = ${If2.toFixed(2)} A`,
            line: { color: '#ef4444', width: 3 },
        }, traceIdx);
        Plotly.addTraces('mmfGraph', {
            x: [pIf0_end_x], y: [pIf0_end_y],
            mode: 'markers', name: `If2 tip`,
            marker: { color: '#ef4444', size: 10, symbol: 'triangle-up' },
            showlegend: false
        });
        traceIdx += 2;
        
        // Draw resultant If0 vector smoothly
        await animateLine('mmfGraph', xBase, yBase, pIf0_end_x, pIf0_end_y, {
            name: `If0 Phasor`,
            line: { color: '#a855f7', width: 3, dash: 'dash' },
        }, traceIdx);
        Plotly.addTraces('mmfGraph', {
            x: [pIf0_end_x], y: [pIf0_end_y],
            mode: 'markers', name: `If0 tip`,
            marker: { color: '#a855f7', size: 12, symbol: 'star' },
            showlegend: false
        });
        traceIdx += 2;
        
        // Label the resultant phasor tip
        Plotly.addTraces('mmfGraph', {
            x: [pIf0_end_x], y: [pIf0_end_y],
            mode: 'text', name: 'If0 Tip Label',
            text: [`If0 phasor tip`],
            textposition: 'top right',
            textfont: { color: '#a855f7', size: 11, family: 'monospace' },
            showlegend: false
        });
        traceIdx++;

        // Draw swing arc to transfer magnitude to x-axis
        const arcX = [];
        const arcY = [];
        const arcSteps = 30;
        const theta_start = Math.atan2(If2y, If0x);
        for (let i = 0; i <= arcSteps; i++) {
            const angle = theta_start * (1 - i / arcSteps);
            arcX.push(xBase + If0 * Math.cos(angle));
            arcY.push(yBase + (If0 * Math.sin(angle)) * scale);
        }
        await animatePoints('mmfGraph', arcX, arcY, {
            name: 'Swing Arc (If0 magnitude)',
            line: { color: '#a855f7', width: 1.5, dash: 'dashdot' }
        }, traceIdx);
        traceIdx++;

        // Mark the landed point representing the scalar magnitude
        Plotly.addTraces('mmfGraph', {
            x: [If0], y: [yBase],
            mode: 'markers+text', name: 'If0 Point',
            text: [`If0 = ${If0.toFixed(2)} A`],
            textposition: 'bottom right',
            textfont: { color: '#a855f7', size: 12, fontStyle: 'bold' },
            marker: { color: '#a855f7', size: 10, symbol: 'circle' }
        });
        traceIdx++;
    });

    // ─────── STEP 8: Find E0 from OCC at If0, calculate regulation ───────
    await animateStep(8, "Using the projected field current magnitude <b>If0 = " + calcResults.If0.toFixed(2) + " A</b> on the horizontal axis, we draw a vertical line up to the OCC to determine <b>E0</b>.", async () => {
        const If0 = calcResults.If0;
        const yBase = data.ratedV * 0.15;
        
        const E0_line = interpolateXtoY(data.occIf, data.occVoc, If0);
        const E0_phase = E0_line / Math.sqrt(3);
        const V_phase = calcResults.V_phase;
        const reg = ((E0_phase - V_phase) / V_phase) * 100;
        
        calcResults.E0_line = E0_line;
        calcResults.E0_phase = E0_phase;
        calcResults.reg = reg;
        
        // Draw vertical line from yBase at If0 up to OCC smoothly
        await animateLine('mmfGraph', If0, yBase, If0, E0_line, {
            name: 'If0 → E0',
            line: { color: '#a855f7', dash: 'dot', width: 2 }
        }, traceIdx);
        traceIdx++;
        
        // Draw horizontal line from E0 to y-axis smoothly
        await animateLine('mmfGraph', If0, E0_line, 0, E0_line, {
            name: `E0 = ${E0_line.toFixed(1)} V`,
            line: { color: '#a855f7', dash: 'dot', width: 1.5 }
        }, traceIdx);
        traceIdx++;
        
        // Mark E0 point on OCC
        Plotly.addTraces('mmfGraph', {
            x: [If0], y: [E0_line],
            mode: 'markers+text', name: 'E0 Point',
            text: [`E0 = ${E0_line.toFixed(1)} V`],
            textposition: 'top left',
            textfont: { color: '#a855f7', size: 12 },
            marker: { color: '#a855f7', size: 12, symbol: 'star' }
        });
        traceIdx++;

        // Show results
        const angleDeg = (calcResults.angleBetween * 180 / Math.PI).toFixed(1);
        const phiDeg = (Math.acos(data.pf) * 180 / Math.PI).toFixed(1);
        
        document.getElementById('resultsCard').style.display = 'block';
        document.getElementById('calculationsText').innerHTML = `
            <strong>Phase Voltage (V):</strong> ${V_phase.toFixed(2)} V<br>
            <strong>Power Factor Angle (φ):</strong> ${phiDeg}°<br>
            <hr style="border-color: var(--border); margin: 8px 0;">
            <strong>If1 (for rated voltage from OCC):</strong> ${calcResults.If1.toFixed(3)} A<br>
            <strong>If2 (for rated current from SCC):</strong> ${calcResults.If2.toFixed(3)} A<br>
            <strong>Angle between If1 and If2:</strong> ${angleDeg}° (${data.pfType})<br>
            <strong style="color: #a855f7;">Resultant If0:</strong> ${calcResults.If0.toFixed(3)} A<br>
            <hr style="border-color: var(--border); margin: 8px 0;">
            <strong>E0 (Line-to-Line):</strong> ${E0_line.toFixed(2)} V<br>
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
    document.getElementById('explanationText').innerHTML = "Welcome to the MMF Method simulation. Enter data and start the animation.";
    updateStatusLED('ready');
    initGraph();
}

function generateReport() {
    const data = parseInput();
    let csv = "MMF Method Lab Report\n\n";
    csv += "Inputs:\n";
    csv += `Rated Voltage,${data.ratedV} V\n`;
    csv += `Rated Current,${data.ratedI} A\n`;
    csv += `Power Factor,${data.pf} ${data.pfType}\n\n`;
    csv += "Results:\n";
    csv += `Phase Voltage,${calcResults.V_phase.toFixed(2)} V\n`;
    csv += `If1 (for rated V),${calcResults.If1.toFixed(3)} A\n`;
    csv += `If2 (for rated I),${calcResults.If2.toFixed(3)} A\n`;
    csv += `Angle between If1 and If2,${(calcResults.angleBetween * 180 / Math.PI).toFixed(1)} degrees\n`;
    csv += `Resultant If0,${calcResults.If0.toFixed(3)} A\n`;
    csv += `E0 (Line),${calcResults.E0_line.toFixed(2)} V\n`;
    csv += `E0 (Phase),${calcResults.E0_phase.toFixed(2)} V\n`;
    csv += `Voltage Regulation,${calcResults.reg.toFixed(2)} %\n`;
    
    downloadCSV('MMF_Lab_Report.csv', csv);
}
