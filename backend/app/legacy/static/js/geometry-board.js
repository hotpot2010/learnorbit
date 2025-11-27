/**
 * Geometry Drawing Board Functionality
 */
document.addEventListener('DOMContentLoaded', () => {
    const geometryTab = document.getElementById('geometryTab');
    const canvas = document.getElementById('geometryCanvas');
    const ctx = canvas?.getContext('2d');
    const toolbar = geometryTab?.querySelector('.geometry-toolbar');
    const toolButtons = toolbar?.querySelectorAll('.tool-button:not(.clear-button)');
    const clearButton = document.getElementById('clearGeometryCanvas');
    const canvasContainer = geometryTab?.querySelector('.geometry-canvas-container');

    if (!canvas || !ctx || !toolbar || !toolButtons || !clearButton || !canvasContainer) {
        // Don't log error if the tab itself isn't active initially
        // console.error("Geometry board elements not found. Initialization skipped.");
        return;
    }

    let currentTool = 'point'; // Default tool
    let isDrawing = false;
    let startX, startY, currentX, currentY;
    let shapes = []; // Array to store drawn shapes
    let resizeTimeout;

    // --- Initialization ---
    function initGeometryBoard() {
        console.log("Initializing Geometry Board");
        resizeCanvas();
        addEventListeners();
        setActiveToolButton(toolbar.querySelector('.tool-button[data-tool="point"]')); // Set initial active button
    }

    // --- Canvas Resizing --- (with debouncing)
    function resizeCanvas() {
        // Get container dimensions
        const containerWidth = canvasContainer.clientWidth;
        const containerHeight = canvasContainer.clientHeight;
        
        // Set canvas dimensions
        // Check if dimensions actually changed to avoid unnecessary redraws
        if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
            canvas.width = containerWidth;
            canvas.height = containerHeight;
            console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
            redrawCanvas(); // Redraw existing shapes
        }
    }
    
    function debounceResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 150); // Adjust delay as needed
    }

    // --- Event Listeners ---
    function addEventListeners() {
        // Toolbar buttons
        toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                currentTool = button.dataset.tool;
                setActiveToolButton(button);
                console.log("Tool selected:", currentTool);
            });
        });

        // Clear button
        clearButton.addEventListener('click', () => {
            shapes = [];
            redrawCanvas();
            console.log("Canvas cleared");
        });

        // Canvas mouse events
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseout', handleMouseOut); // Handle mouse leaving canvas

        // Window resize
        window.addEventListener('resize', debounceResize);
        
        // Tab activation (using MutationObserver for robustness)
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class' && geometryTab.classList.contains('active')) {
                     // Tab became active, ensure canvas size is correct
                     console.log("Geometry tab activated, checking canvas size.");
                     // Use timeout to ensure layout is stable after class change
                     setTimeout(resizeCanvas, 50); 
                }
            });
        });
        observer.observe(geometryTab, { attributes: true });
    }

    function setActiveToolButton(activeButton) {
        toolButtons.forEach(btn => btn.classList.remove('active'));
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // --- Mouse Event Handlers ---
    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    function handleMouseDown(e) {
        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;
        currentX = startX;
        currentY = startY;

        if (currentTool === 'point') {
            addShape({ type: 'point', x: startX, y: startY });
            isDrawing = false; // Point is drawn on click, no drag needed
            redrawCanvas();
        }
        console.log("Mouse down at:", startX, startY);
    }

    function handleMouseMove(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        currentX = pos.x;
        currentY = pos.y;
        redrawCanvas(); // Redraw everything + preview
    }

    function handleMouseUp(e) {
        if (!isDrawing) return;
        isDrawing = false;
        const pos = getMousePos(e);
        currentX = pos.x;
        currentY = pos.y;

        // Add the final shape (except for point, which was added on mousedown)
        if (currentTool === 'line') {
            if (Math.abs(currentX - startX) > 2 || Math.abs(currentY - startY) > 2) { // Avoid zero-length lines
                 addShape({ type: 'line', x1: startX, y1: startY, x2: currentX, y2: currentY });
            }
        } else if (currentTool === 'circle') {
             const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
             if (radius > 1) {
                 addShape({ type: 'circle', cx: startX, cy: startY, radius: radius });
             }
        } else if (currentTool === 'triangle') {
            if (Math.abs(currentX - startX) > 2 || Math.abs(currentY - startY) > 2) {
                 // Simple isosceles triangle based on the dragged base
                 addShape({ type: 'triangle', x1: startX, y1: startY, x2: currentX, y2: currentY });
             }
        }
        
        redrawCanvas(); // Redraw with the final shape
        console.log("Mouse up, shape added (if applicable)");
    }

    function handleMouseOut(e) {
        // Optional: Cancel drawing if mouse leaves canvas while dragging?
        // if (isDrawing) {
        //     isDrawing = false;
        //     redrawCanvas(); // Remove preview
        //     console.log("Mouse out, drawing cancelled");
        // }
    }

    // --- Shape Management ---
    function addShape(shapeData) {
        // Add default style properties
        const defaults = {
            point: { color: 'black', radius: 3 },
            line: { color: 'black', lineWidth: 2 },
            circle: { color: 'red', lineWidth: 1 },
            triangle: { color: 'blue', lineWidth: 1 },
        };
        const shape = { ...defaults[shapeData.type], ...shapeData };
        shapes.push(shape);
        console.log("Added shape:", shape);
    }

    // --- Drawing Functions ---
    function redrawCanvas() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw all stored shapes
        shapes.forEach(shape => {
            drawShape(shape);
        });

        // Draw preview if currently drawing
        if (isDrawing) {
            drawPreview();
        }
    }

    function drawShape(shape) {
        ctx.beginPath();
        ctx.strokeStyle = shape.color || 'black';
        ctx.fillStyle = shape.color || 'black';
        ctx.lineWidth = shape.lineWidth || 1;

        switch (shape.type) {
            case 'point':
                ctx.arc(shape.x, shape.y, shape.radius || 3, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'line':
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.stroke();
                break;
            case 'circle':
                ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'triangle':
                // Draw isosceles triangle based on base (x1,y1) -> (x2,y2)
                const midX = (shape.x1 + shape.x2) / 2;
                const midY = (shape.y1 + shape.y2) / 2;
                const dx = shape.x2 - shape.x1;
                const dy = shape.y2 - shape.y1;
                const len = Math.sqrt(dx*dx + dy*dy);
                const heightFactor = 0.5; // Adjust height relative to base
                // Calculate third vertex position (perpendicular to midpoint)
                const x3 = midX - heightFactor * dy; // Simplified perpendicular vector
                const y3 = midY + heightFactor * dx;
                
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.lineTo(x3, y3);
                ctx.closePath();
                ctx.stroke();
                break;
        }
    }

    function drawPreview() {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; // Preview color
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); // Dashed line for preview

        switch (currentTool) {
            case 'line':
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                ctx.stroke();
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
                ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
             case 'triangle':
                // Draw preview base line
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                // Calculate preview third vertex
                const midXp = (startX + currentX) / 2;
                const midYp = (startY + currentY) / 2;
                const dxp = currentX - startX;
                const dyp = currentY - startY;
                const heightFactorP = 0.5;
                const x3p = midXp - heightFactorP * dyp;
                const y3p = midYp + heightFactorP * dxp;
                ctx.lineTo(x3p, y3p);
                ctx.closePath();
                ctx.stroke();
                break;
            // No preview needed for 'point'
        }
        ctx.setLineDash([]); // Reset line dash
    }

    // --- Start Initialization ---
    // Need slight delay for container size to be calculated correctly initially
    setTimeout(initGeometryBoard, 100); 
}); 