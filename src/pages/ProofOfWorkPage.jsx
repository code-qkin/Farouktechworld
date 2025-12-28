import React, { useState, useMemo, useEffect } from 'react';
import { Play, Camera, Wrench, ChevronRight, X, Clock, CheckCircle, ChevronLeft, Loader2 } from 'lucide-react';
import Stats from '../components/Stats';
import { Link } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

const ProjectCard = ({ project, onClick }) => {
    return (
        <div 
            onClick={() => onClick(project)}
            className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
            {/* Media Area */}
            <div className="relative h-64 overflow-hidden bg-slate-100">
                {project.type === 'video' ? (
                    <>
                        <video 
                            src={project.videoUrl} 
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" 
                            muted 
                            loop 
                            playsInline
                            onMouseOver={event => event.target.play()} 
                            onMouseOut={event => event.target.pause()} 
                            poster={project.thumbnail}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-full shadow-lg">
                                <Play size={24} className="text-white fill-current"/>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="relative w-full h-full">
                        {/* After Image (Default) */}
                        <img src={project.after} alt={project.title} className="w-full h-full object-cover absolute inset-0 z-10" />
                        
                        {/* Interactive Overlay Hint */}
                        <div className="absolute top-3 right-3 z-20 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={12}/> View Before
                        </div>
                    </div>
                )}
                
                {/* Category Badge */}
                <div className="absolute top-3 left-3 z-20">
                    <span className="bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        {project.category}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6">
                <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-1">{project.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{project.desc}</p>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
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

const Modal = ({ project, onClose }) => {
    if (!project) return null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 p-2 rounded-full text-black backdrop-blur-md transition">
                    <X size={24}/>
                </button>

                <div className="w-full md:w-2/3 bg-black flex items-center justify-center relative group">
                    {project.type === 'video' ? (
                        <video src={project.videoUrl} className="w-full h-full object-contain" controls autoPlay />
                    ) : (
                        <div className="relative w-full h-full">
                            <div className="absolute top-6 left-6 z-20 bg-black/60 text-white px-4 py-2 rounded-lg font-bold text-sm backdrop-blur-md pointer-events-none">
                                HOVER TO SEE "BEFORE"
                            </div>
                            <img src={project.before} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
                            <img src={project.after} alt="After" className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 hover:opacity-0" />
                        </div>
                    )}
                </div>

                <div className="w-full md:w-1/3 bg-white p-8 overflow-y-auto">
                    <div className="mb-6">
                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            {project.category} repair
                        </span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 leading-tight">{project.title}</h2>
                    <p className="text-slate-600 leading-relaxed mb-8">{project.desc}</p>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="bg-white p-2 rounded-lg text-purple-600 shadow-sm"><Clock size={20}/></div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">Turnaround Time</p>
                                <p className="text-slate-900 font-bold">{project.duration}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="bg-white p-2 rounded-lg text-green-600 shadow-sm"><CheckCircle size={20}/></div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">Warranty</p>
                                <p className="text-slate-900 font-bold">30 Days Guarantee</p>
                            </div>
                        </div>
                    </div>

                    <Link to="/#contact" className="block w-full bg-slate-900 text-white text-center py-4 rounded-xl font-bold hover:bg-purple-700 transition shadow-lg hover:shadow-purple-500/20">
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
                    We don't just tell you we're good; we show you. Browse our gallery of impossible fixes, intricate microsoldering, and stunning restorations.
                </p>
            </div>

            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm overflow-x-auto no-scrollbar">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-center gap-2 py-4 min-w-max">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => handleCategoryChange(cat)} className={`px-6 py-2 rounded-full text-sm font-bold transition-all uppercase tracking-wide ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div id="gallery-start" className="max-w-7xl mx-auto px-6 py-16">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-purple-600"/></div>
                ) : currentProjects.length === 0 ? (
                    <div className="text-center py-20">
                        <Wrench className="w-16 h-16 text-slate-200 mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-slate-400">No projects found in this category.</h3>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {currentProjects.map(p => (
                                <ProjectCard key={p.id} project={p} onClick={setViewProject} />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-16">
                                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm text-slate-600">
                                    <ChevronLeft size={20} />
                                </button>
                                <div className="flex gap-2">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button key={i} onClick={() => goToPage(i + 1)} className={`w-10 h-10 rounded-full font-bold text-sm transition ${currentPage === i + 1 ? 'bg-purple-600 text-white shadow-md transform scale-110' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
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