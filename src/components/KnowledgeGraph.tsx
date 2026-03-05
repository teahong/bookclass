import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize, Minimize, Printer } from 'lucide-react';

interface KnowledgeGraphProps {
    books: any[];
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ books }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        if (!books.length || !svgRef.current) return;

        const containerWidth = containerRef.current ? containerRef.current.clientWidth : 800;
        const width = isFullScreen ? window.innerWidth - 40 : containerWidth;
        const height = isFullScreen ? window.innerHeight - 100 : 400;

        // Clear previous SVG
        const svgElement = d3.select(svgRef.current);
        svgElement.selectAll("*").remove();

        const svg = svgElement
            .attr("viewBox", [0, 0, width, height])
            .attr("width", "100%")
            .attr("height", height);

        // Add Zoom behavior
        const g = svg.append("g");

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom as any);

        // Prepare data
        const nodes: any[] = [{ id: "Root", type: "root", label: "책머리" }];
        const links: any[] = [];
        const addedNodes = new Set(["Root"]);

        books.forEach(book => {
            // 1. Book Node
            if (!addedNodes.has(book.id)) {
                nodes.push({ id: book.id, type: "book", label: book.title });
                addedNodes.add(book.id);
            }
            links.push({ source: "Root", target: book.id });

            // 2. Author Node
            if (book.author) {
                const mainAuthor = book.author.split(/,|\||\//)[0].trim();
                const authorId = `author-${mainAuthor}`;

                if (!addedNodes.has(authorId)) {
                    nodes.push({ id: authorId, type: "author", label: mainAuthor });
                    addedNodes.add(authorId);
                }
                links.push({ source: book.id, target: authorId });
            }

            // 3. Keywords
            if (book.keywords && Array.isArray(book.keywords)) {
                book.keywords.slice(0, 5).forEach((keyword: string) => {
                    const keywordId = `keyword-${keyword}`;
                    if (!nodes.find(n => n.id === keywordId)) {
                        nodes.push({ id: keywordId, type: 'keyword', label: keyword });
                        addedNodes.add(keywordId);
                    }
                    links.push({ source: book.id, target: keywordId });
                });
            }
        });

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(30));

        const link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line");

        const node = g.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("cursor", "pointer")
            .call(drag(simulation) as any);

        node.append("circle")
            .attr("r", (d: any) => {
                if (d.type === 'root') return 20;
                if (d.type === 'book') return 15;
                if (d.type === 'author') return 10;
                return 8;
            })
            .attr("fill", (d: any) => {
                if (d.type === 'root') return "#6d5dfc";
                if (d.type === 'book') return "#e91e63";
                if (d.type === 'author') return "#f39c12";
                return "#00b894";
            });

        node.append("text")
            .text((d: any) => d.label)
            .attr("x", 15)
            .attr("y", 5)
            .style("font-size", (d: any) => d.type === 'keyword' ? "10px" : "12px")
            .style("fill", "#333")
            .style("font-weight", (d: any) => d.type === 'book' ? "bold" : "normal")
            .style("text-shadow", "1px 1px 0px white");

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        function drag(simulation: any) {
            function dragstarted(event: any) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }
            function dragged(event: any) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }
            function dragended(event: any) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }
            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }
    }, [books, isFullScreen]);

    const handlePrint = () => {
        const svg = svgRef.current;
        if (!svg) return;

        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>독서 지식 그래프 인쇄</title>
                        <style>
                            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                            svg { width: 100%; height: 100%; max-height: 100vh; }
                        </style>
                    </head>
                    <body>
                        ${svg.outerHTML}
                        <script>
                            // 렌더링 확보를 위해 잠시 대기 후 인쇄
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
        }
    };

    return (
        <div
            ref={containerRef}
            className={`glass-card ${isFullScreen ? 'fullscreen' : ''}`}
            style={{
                marginTop: isFullScreen ? '0' : '40px',
                padding: '20px',
                position: isFullScreen ? 'fixed' : 'relative',
                top: isFullScreen ? 0 : 'auto',
                left: isFullScreen ? 0 : 'auto',
                width: isFullScreen ? '100vw' : 'auto',
                height: isFullScreen ? '100vh' : 'auto',
                zIndex: isFullScreen ? 1000 : 1,
                backgroundColor: isFullScreen ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.7)',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>나의 독서 지식 그래프</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handlePrint}
                        className="btn"
                        style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}
                        title="프린트하기"
                    >
                        <Printer size={16} /> 인쇄
                    </button>
                    <button
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="btn"
                        style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}
                        title={isFullScreen ? "축소하기" : "전체화면"}
                    >
                        {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
                        {isFullScreen ? "축소" : "확대"}
                    </button>
                </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px', textAlign: 'center' }}>
                마우스 휠로 확대/축소하고 드래그하여 이동할 수 있습니다.
            </p>

            <div style={{
                flex: 1,
                border: '1px solid #ddd',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#f8f9fa',
                position: 'relative'
            }}>
                <svg ref={svgRef} style={{ width: '100%', height: '100%', cursor: 'grab', display: 'block' }}></svg>
            </div>

            <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', marginTop: '15px', justifyContent: 'center' }}>
                <span><span style={{ color: '#6d5dfc' }}>●</span> 책머리</span>
                <span><span style={{ color: '#e91e63' }}>●</span> 도서</span>
                <span><span style={{ color: '#f39c12' }}>●</span> 대표 저자</span>
                <span><span style={{ color: '#00b894' }}>●</span> 책에 대한 내 생각</span>
            </div>
        </div>
    );
};
export default KnowledgeGraph;
