import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Camera, Wrench, ChevronRight, X, Clock, CheckCircle, ChevronLeft, Loader2 } from 'lucide-react';
import Stats from '../components/Stats';
import { Link } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1588508065123-287b28e013da?q=80&w=800&auto=format&fit=crop";

// --- CARD COMPONENT ---
const ProjectCard = ({ project, onClick }) => {
    const videoRef = useRef(null);

    // Auto-play video on hover (Desktop) or always (if desired for mobile preview)
    const handleMouseEnter = () => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {}); // Ignore play errors
        }
    };

    const handleMouseLeave = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0; // Reset to start
        }
    };

    return (
        <div 
            onClick={() => onClick(project)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
        >
            {/* Media Area - Fixed Aspect Ratio */}
            <div className="relative w-full h-64 bg-slate-100 overflow-hidden">
                {project.type === 'video' ? (
                    <div className="w-full h-full relative">
                        {/* Video Element: Acts as its own thumbnail */}
                        <video 
                            ref={videoRef}
                            src={project.videoUrl} 
                            className="w-full h-full object-cover"
                            muted 
                            loop 
                            playsInline // CRITICAL for Mobile
                            preload="metadata"
                        />
                        
                        {/* Play Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10 group-hover:bg-transparent transition">
                            <div className="bg-white/30 backdrop-blur-md p-4 rounded-full shadow-lg border border-white/50 group-hover:scale-110 transition-transform">
                                <Play size={24} className="text-white fill-current"/>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Image Handling - Simplified CSS for Mobile Reliability
                    <div className="w-full h-full">
                        <img 
                            src={project.after || DEFAULT_IMAGE} 
                            alt={project.title} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        
                        {/* Hint Badge */}
                        <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={12}/> View Project
                        </div>
                    </div>
                )}
                
                {/* Category Badge */}
                <div className="absolute top-3 left-3 z-20 pointer-events-none">
                    <span className="bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        {project.category}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-1">{project.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1">{project.desc}</p>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <Clock size={14}/> {project.duration}
                    </span>
                    <span className="text-purple-600 text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                        See Details <ChevronRight size={14}/>
                    </span>
                </div>
            </div>
        </div>
    );
};

// --- MODAL COMPONENT ---
const Modal = ({ project, onClose }) => {
    const [isShowingBefore, setIsShowingBefore] = useState(false);
    const [videoMode, setVideoMode] = useState('after');

    useEffect(() => {
        setIsShowingBefore(false);
        setVideoMode('after');
    }, [project]);

    if (!project) return null;
    
    const hasBeforeVideo = project.type === 'video' && project.videoBeforeUrl && project.videoBeforeUrl.trim() !== "";
    const beforeImage = project.before || DEFAULT_IMAGE;
    const afterImage = project.after || DEFAULT_IMAGE;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]">
                
                <button onClick={onClose} className="absolute top-4 right-4 z-50 bg-black/20 hover:bg-black/40 p-2 rounded-full text-white backdrop-blur-md transition">
                    <X size={24}/>
                </button>

                <div className="w-full md:w-2/3 bg-black flex flex-col items-center justify-center relative group select-none overflow-hidden h-[40vh] md:h-auto">
                    {project.type === 'video' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
                            <video 
                                key={videoMode} 
                                src={videoMode === 'before' ? project.videoBeforeUrl : project.videoUrl} 
                                className="w-full h-full object-contain" 
                                controls 
                                autoPlay 
                                playsInline 
                                preload="auto"
                            />
                            {hasBeforeVideo && (
                                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-30 pointer-events-auto">
                                    <button 
                                        onClick={() => setVideoMode('before')}
                                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md transition ${videoMode === 'before' ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-black/70'}`}
                                    >
                                        Before Repair
                                    </button>
                                    <button 
                                        onClick={() => setVideoMode('after')}
                                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md transition ${videoMode === 'after' ? 'bg-purple-600 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}
                                    >
                                        After Repair
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div 
                            className="relative w-full h-full cursor-crosshair touch-none"
                            onMouseEnter={() => setIsShowingBefore(true)}
                            onMouseLeave={() => setIsShowingBefore(false)}
                            onTouchStart={() => setIsShowingBefore(true)}
                            onTouchEnd={() => setIsShowingBefore(false)}
                        >
                            <div className="absolute top-6 left-6 z-30 pointer-events-none">
                                <div className="bg-white/90 text-slate-900 px-4 py-2 rounded-lg font-bold text-xs shadow-lg backdrop-blur-md flex items-center gap-2">
                                    <span className="md:hidden">👆 Touch & Hold</span>
                                    <span className="hidden md:inline">🖱️ Hover</span>
                                </div>
                            </div>

                            <div className="absolute bottom-6 left-0 right-0 z-30 text-center pointer-events-none">
                                <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg transition-colors ${
                                    isShowingBefore ? "bg-red-600 text-white" : "bg-green-600 text-white"
                                }`}>
                                    {isShowingBefore ? "Before Repair" : "After Repair"}
                                </span>
                            </div>

                            {/* Images Stacked - Using Absolute to ensure overlap, but simplified container */}
                            <img 
                                src={beforeImage} 
                                alt="Before" 
                                className="absolute inset-0 w-full h-full object-contain bg-black"
                            />
                            <img 
                                src={afterImage} 
                                alt="After" 
                                className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-200 ${isShowingBefore ? 'opacity-0' : 'opacity-100'}`} 
                            />
                        </div>
                    )}
                </div>

                {/* Details Sidebar */}
                <div className="w-full md:w-1/3 bg-white p-6 md:p-8 overflow-y-auto max-h-[50vh] md:max-h-full">
                    <div className="mb-4">
                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            {project.category} repair
                        </span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3 leading-tight">{project.title}</h2>
                    <p className="text-slate-600 leading-relaxed mb-6 text-sm">{project.desc}</p>

                    <div className="space-y-3 mb-8">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="bg-white p-2 rounded-lg text-purple-600 shadow-sm"><Clock size={18}/></div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Turnaround</p>
                                <p className="text-sm text-slate-900 font-bold">{project.duration}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="bg-white p-2 rounded-lg text-green-600 shadow-sm"><CheckCircle size={18}/></div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Warranty</p>
                                <p className="text-sm text-slate-900 font-bold">30 Days Guarantee</p>
                            </div>
                        </div>
                    </div>

                    <Link to="/#contact" className="block w-full bg-slate-900 text-white text-center py-4 rounded-xl font-bold hover:bg-purple-700 transition shadow-lg hover:shadow-purple-500/20 active:scale-95">
                        Book This Repair
                    </Link>
                </div>
            </div>
        </div>
    );
};

const ProofOfWorkPage = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewProject, setViewProject] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const q = query(collection(db, "ProofOfWork"), orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Failed to load portfolio:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const categories = useMemo(() => ['All', ...new Set(projects.map(p => p.category))], [projects]);

    const filteredProjects = useMemo(() => {
        if (selectedCategory === 'All') return projects;
        return projects.filter(p => p.category === selectedCategory);
    }, [selectedCategory, projects]);

    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

    const handleCategoryChange = (cat) => {
        setSelectedCategory(cat);
        setCurrentPage(1);
    };

    const goToPage = (pageNumber) => {
        if (pageNumber < 1 || pageNumber > totalPages) return;
        setCurrentPage(pageNumber);
        const grid = document.getElementById('gallery-start');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <div className="bg-purple-900 text-white pt-32 pb-20 px-6 text-center">
                <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                    Proof of <span className="text-purple-300">Work</span>
                </h1>
                <p className="text-purple-100 max-w-2xl mx-auto text-lg leading-relaxed">
                    Real results. Real devices. See our repair gallery.
                </p>
            </div>

            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm overflow-x-auto no-scrollbar">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-start md:justify-center gap-2 py-4 min-w-max">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => handleCategoryChange(cat)} className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all uppercase tracking-wide whitespace-nowrap ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div id="gallery-start" className="max-w-7xl mx-auto px-6 py-12 md:py-16">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-purple-600"/></div>
                ) : currentProjects.length === 0 ? (
                    <div className="text-center py-20">
                        <Wrench className="w-16 h-16 text-slate-200 mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-slate-400">No projects found.</h3>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            {currentProjects.map(p => (
                                <ProjectCard key={p.id} project={p} onClick={setViewProject} />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-16">
                                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm text-slate-600">
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
                                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm text-slate-600">
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="mb-20"><Stats /></div>
            <Modal project={viewProject} onClose={() => setViewProject(null)} />
        </div>
    );
};

export default ProofOfWorkPage;