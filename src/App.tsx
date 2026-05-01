/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  updateDoc,
  where,
  or,
  User
} from './firebase';
import { 
  Plus, 
  Home, 
  LogOut, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Gift,
  User as UserIcon, 
  Hospital, 
  ChevronRight,
  Loader2,
  Stethoscope,
  MapPin,
  Calendar,
  ShieldCheck,
  Users,
  Trash2,
  Search,
  Filter,
  Send,
  X,
  Edit2,
  Settings,
  FilterX,
  ClipboardList,
  Globe,
  RefreshCw,
  RotateCw,
  Download,
  ArrowUpDown,
  ArrowRightLeft,
  ChevronDown,
  LayoutGrid,
  History,
  Map as MapIcon,
  WifiOff,
  Cloud,
  Heart,
  Thermometer,
  Activity,
  Droplets,
  Fingerprint,
  Bell,
  MessageSquare,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ZAMBIA_DATA, GEOLOCATIONS } from './constants';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with focus on markers being lost
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Types ---
interface UserProfile {
  name: string;
  facility: string;
  province: string;
  district: string;
  role?: string;
}

interface Referral {
  id: string;
  patientName: string;
  age: number;
  sex: 'Male' | 'Female';
  smartCareId?: string;
  reasonForReferral?: string;
  diagnosis: string;
  treatmentGiven?: string;
  destination: string;
  urgency: 'Emergency' | 'Urgent' | 'Routine';
  fromFacility: string;
  referredBy: string;
  referredByUid: string;
  timestamp: any;
  sentAt?: any;
  arrivedAt?: any;
  outcomeAt?: any;
  gravida?: string;
  parity?: string;
  lmp?: string;
  gestationAge?: string;
  vitals?: {
    bp?: string;
    hr?: string;
    rr?: string;
    temp?: string;
    spo2?: string;
  };
  outcome?: string;
}

enum Page {
  LOGIN = 'login',
  ONBOARDING = 'onboarding',
  DASHBOARD = 'dashboard',
  FORM = 'form',
  ADMIN = 'admin',
  MAP = 'map',
  PROFILE = 'profile',
  DIRECTORY = 'directory'
}

// --- Components ---

const ErrorNotification = ({ message, onClear }: { message: string, onClear: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClear, 5000);
    return () => clearTimeout(timer);
  }, [onClear]);

  const isSuccess = /success|updated|broadcasted|recorded|arrived|transferred/i.test(message);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed bottom-24 left-6 right-6 z-50 md:left-auto md:right-6 md:max-w-sm"
    >
      <div className={cn(
        "p-4 rounded-2xl shadow-2xl border flex items-start gap-3",
        isSuccess ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-900 border-white/10 text-white"
      )}>
        <div className="mt-0.5">
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold leading-tight tracking-tight">{message}</p>
        </div>
        <button onClick={onClear} className="text-white/40 hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

const OfflineBanner = ({ isOffline, hasPendingWrites }: { isOffline: boolean, hasPendingWrites: boolean }) => {
  return (
    <AnimatePresence>
      {(isOffline || hasPendingWrites) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn(
            "w-full text-white text-[10px] sm:text-xs font-bold py-1 px-4 flex items-center justify-center gap-2 overflow-hidden",
            isOffline ? "bg-amber-600" : "bg-blue-600"
          )}
        >
          {isOffline ? (
            <>
              <WifiOff className="w-3 h-3" />
              <span>Working Offline - Changes will sync when connected</span>
            </>
          ) : (
            <>
              <Cloud className="w-3 h-3 animate-pulse" />
              <span>Syncing changes to cloud...</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className
}: { 
  icon: React.ElementType, 
  title: string, 
  description: string, 
  action?: React.ReactNode,
  className?: string
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center space-y-6", className)}>
      <div className="relative">
        <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-30 scale-125" />
        <div className="relative w-16 h-16 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center">
          <Icon className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      <div className="max-w-[320px] space-y-2">
        <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed font-medium">{description}</p>
      </div>
      {action && (
        <div className="pt-2">
          {action}
        </div>
      )}
    </div>
  );
};

const NotificationCenter = ({ 
  notifications, 
  onClose, 
  onMarkAsRead, 
  onClearAll 
}: { 
  notifications: Notification[], 
  onClose: () => void,
  onMarkAsRead: (id: string) => void,
  onClearAll: () => void
}) => {
  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200"
      >
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Updates & Alerts</h2>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Real-time referral notifications</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {notifications.length === 0 ? (
            <EmptyState 
              icon={Bell}
              title="All caught up"
              description="No new notifications at the moment. We'll alert you when there's an update."
              className="py-16"
            />
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                className={cn(
                  "p-4 rounded border transition-all flex gap-4 cursor-pointer",
                  n.read ? "bg-white border-slate-100 opacity-60" : "bg-white border-blue-200 shadow-sm border-l-4 border-l-blue-600"
                )}
                onClick={() => onMarkAsRead(n.id)}
              >
                <div className={cn(
                  "w-10 h-10 rounded flex items-center justify-center shrink-0",
                  n.type === 'emergency' ? "bg-red-50 text-red-600" : 
                  n.type === 'update' ? "bg-emerald-50 text-emerald-600" : 
                  "bg-blue-50 text-blue-600"
                )}>
                  {n.type === 'emergency' ? <AlertCircle className="w-6 h-6" /> : 
                   n.type === 'update' ? <CheckCircle2 className="w-6 h-6" /> : 
                   <Bell className="w-6 h-6" />}
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 leading-tight">{n.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <button 
              onClick={onClearAll}
              className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-lg hover:bg-slate-100 transition-all shadow-sm"
            >
              Clear All Notifications
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const SyncStatus = ({ isOffline, hasPendingWrites }: { isOffline: boolean, hasPendingWrites: boolean }) => {
  if (isOffline) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
        <WifiOff className="w-3 h-3 text-slate-500" />
        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Offline</span>
      </div>
    );
  }
  if (hasPendingWrites) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
        <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin" />
        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Syncing</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Synced</span>
    </div>
  );
};

const FacilityDirectory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');

  const flattenedFacilities = useMemo(() => {
    const list: { name: string; province: string; district: string; contact: string; type: string }[] = [];
    Object.entries(ZAMBIA_DATA).forEach(([province, districts]) => {
      Object.entries(districts).forEach(([district, facilities]) => {
        facilities.forEach(facility => {
          list.push({
            name: facility,
            province,
            district,
            contact: `+260 ${950 + Math.floor(Math.random() * 50)} ${Math.floor(Math.random() * 899999) + 100000}`,
            type: facility.includes('Hospital') ? 'Hospital' : 
                  facility.includes('Clinic') ? 'Clinic' : 'Health Centre'
          });
        });
      });
    });
    return list;
  }, []);

  const filteredFacilities = useMemo(() => {
    return flattenedFacilities.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           f.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           f.province.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvince = provinceFilter === 'All' || f.province === provinceFilter;
      const matchesDistrict = districtFilter === 'All' || f.district === districtFilter;
      return matchesSearch && matchesProvince && matchesDistrict;
    });
  }, [flattenedFacilities, searchTerm, provinceFilter, districtFilter]);

  const provinces = Object.keys(ZAMBIA_DATA);
  const availableDistricts = provinceFilter !== 'All' ? Object.keys(ZAMBIA_DATA[provinceFilter]) : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight leading-tight">Facility Directory</h1>
          <p className="text-slate-500 font-medium">Find contact information for Zambian medical facilities</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider border border-slate-200">
          <Hospital className="w-4 h-4" />
          {flattenedFacilities.length} Facilities
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative group md:col-span-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text"
              placeholder="Search facility or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="relative flex items-center">
            <Filter className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
            <select 
              value={provinceFilter}
              onChange={(e) => {
                setProvinceFilter(e.target.value);
                setDistrictFilter('All');
              }}
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-lg text-sm font-bold appearance-none focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
            >
              <option value="All">All Provinces</option>
              {provinces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-4 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative flex items-center">
            <Filter className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
            <select 
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              disabled={provinceFilter === 'All'}
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-lg text-sm font-bold appearance-none focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="All">All Districts</option>
              {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown className="absolute right-4 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFacilities.length === 0 ? (
          <div className="col-span-full">
            <EmptyState 
              icon={FilterX}
              title="No facilities found"
              description="We couldn't find any facilities matching your filters. Try adjusting your search criteria."
              action={
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setProvinceFilter('All');
                    setDistrictFilter('All');
                  }}
                  className="bg-blue-500 text-white px-6 py-2.5 rounded-md font-bold text-sm shadow hover:bg-blue-600 transition-all"
                >
                  Clear all filters
                </button>
              }
              className="bg-white rounded-xl border border-slate-200 py-16 shadow-sm"
            />
          </div>
        ) : (
          filteredFacilities.map((f, i) => (
            <motion.div 
              key={`${f.province}-${f.district}-${f.name}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.01 }}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "w-10 h-10 rounded flex items-center justify-center transition-transform",
                    f.type === 'Hospital' ? "bg-red-50 text-red-600" : 
                    f.type === 'Clinic' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                  )}>
                    <Hospital className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {f.province}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                    {f.name}
                  </h3>
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold uppercase tracking-wide">{f.district}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase">Contact</span>
                    <a href={`tel:${f.contact}`} className="text-blue-600 font-bold hover:underline">
                      {f.contact}
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button 
                  onClick={() => {}}
                  className="w-full py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  Call Facility
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const HistoryModal = ({ patientName, referrals, onClose }: { patientName: string, referrals: Referral[], onClose: () => void }) => {
  const history = useMemo(() => referrals
    .filter(r => r.patientName.toLowerCase() === patientName.toLowerCase())
    .sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)), [referrals, patientName]);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-slate-200"
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white border border-slate-200 text-blue-600 rounded">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold tracking-tight text-slate-900">Clinical History</h2>
              <p className="text-xs text-slate-500 font-semibold">Record for <span className="text-blue-600">{patientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Clock className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-400 font-medium tracking-tight">No previous clinical history found.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 pb-4">
              {history.map((item) => (
                <div key={item.id} className="relative pl-8">
                  <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-sm" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="px-3 py-1 bg-slate-900 text-white text-[9px] font-bold rounded-lg uppercase tracking-wider">
                        {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleDateString() : 'Active'}
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        item.urgency === 'Emergency' ? 'bg-red-50 text-red-600 border border-red-100' : 
                        item.urgency === 'Urgent' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      )}>{item.urgency}</span>
                    </div>
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Facility Route</p>
                        <p className="text-sm font-bold text-slate-800">{item.fromFacility} → {item.destination}</p>
                      </div>
                      
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Diagnosis</p>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.diagnosis}</p>
                      </div>

                      {item.outcome && (
                        <div className="pt-3 border-t border-slate-50">
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Clinical Outcome
                          </p>
                          <p className="text-xs text-emerald-800 font-bold bg-emerald-50/50 p-2 rounded-lg">{item.outcome}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-colors shadow-sm active:scale-95 transition-transform"
          >
            Close History
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ConfirmationModal = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  type = "danger",
  icon
}: { 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void,
  confirmText?: string,
  cancelText?: string,
  type?: "danger" | "warning" | "info" | "success",
  icon?: React.ReactNode
}) => {
  const themes = {
    danger: "bg-red-50 text-red-600 ring-red-100",
    warning: "bg-orange-50 text-orange-600 ring-orange-100",
    info: "bg-blue-50 text-blue-600 ring-blue-100",
    success: "bg-emerald-50 text-emerald-600 ring-emerald-100"
  };

  const btnThemes = {
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-red-100",
    warning: "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-100",
    info: "bg-blue-500 hover:bg-blue-600 text-white shadow-sky-100",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-8 border border-slate-100"
          >
            <div className="space-y-5 text-center flex flex-col items-center">
              <div className={cn(
                "w-16 h-16 rounded-lg flex items-center justify-center ring-4 transition-all shadow-inner",
                themes[type]
              )}>
                {icon || <AlertCircle className="w-8 h-8" />}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight leading-tight">{title}</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">{message}</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={onConfirm}
                className={cn(
                  "w-full py-3.5 font-bold rounded-lg shadow transition-all active:scale-95 flex items-center justify-center gap-2",
                  btnThemes[type]
                )}
              >
                {confirmText}
              </button>
              <button 
                onClick={onCancel}
                className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-all active:scale-95"
              >
                {cancelText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message) {
        try {
          const parsed = JSON.parse(event.error.message);
          if (parsed.error) {
            setHasError(true);
            setErrorInfo(parsed.error);
          }
        } catch {
          // Not a JSON error
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">System Error</h2>
          <p className="text-gray-600 mb-6">{errorInfo || "An unexpected error occurred. Please refresh the page."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Refresh App
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const VitalCard = ({ icon, label, value, unit, color, bgColor }: { 
  icon: React.ReactNode, 
  label: string, 
  value?: string, 
  unit?: string,
  color: string,
  bgColor: string
}) => {
  if (!value) return null;
  return (
    <div className={cn("p-4 rounded-lg border border-slate-200 flex flex-col justify-between h-full bg-white group hover:shadow-md transition-all shadow-sm")}>
      <div className={cn("p-2 rounded border border-slate-100 w-fit mb-3 bg-white", color)}>
        {React.cloneElement(icon as React.ReactElement, { size: 18 })}
      </div>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">{label}</p>
        <p className="text-xl font-display font-bold tracking-tight text-slate-900">
          {value} <span className="text-[10px] font-sans font-semibold text-slate-400">{unit}</span>
        </p>
      </div>
    </div>
  );
};

const MapView = ({ referrals, onAction }: { referrals: Referral[], onAction?: () => void }) => {
  const zambiaCenter: [number, number] = [-13.1339, 27.8493];
  
  // Group referrals by destination to show counts
  const destinationCounts = useMemo(() => {
    const counts: Record<string, { count: number, referrals: Referral[] }> = {};
    referrals.forEach(ref => {
      if (!counts[ref.destination]) {
        counts[ref.destination] = { count: 0, referrals: [] };
      }
      counts[ref.destination].count += 1;
      counts[ref.destination].referrals.push(ref);
    });
    return counts;
  }, [referrals]);

  if (referrals.length === 0) {
    return (
      <div className="h-[calc(100vh-200px)] w-full rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200 bg-white flex items-center justify-center">
        <EmptyState 
          icon={Globe}
          title="Map view is empty"
          description="There are currently no referrals to display on the map. Active referrals will appear here with facility locations."
          action={
            onAction && (
              <button 
                onClick={onAction}
                className="bg-blue-500 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-sky-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Submit Referral
              </button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] w-full rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-white z-0">
      <MapContainer center={zambiaCenter} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {(Object.entries(destinationCounts) as [string, { count: number, referrals: Referral[] }][]).map(([dest, data]) => {
          const coords = GEOLOCATIONS[dest];
          if (!coords) return null;
          
          return (
            <Marker key={dest} position={coords}>
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <h4 className="font-bold text-sm mb-1">{dest}</h4>
                  <p className="text-xs text-slate-600 mb-2 font-medium">
                    {data.count} Referral{data.count !== 1 ? 's' : ''} Received
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {data.referrals.map(r => (
                      <div key={r.id} className="text-[10px] border-l-2 border-blue-500 pl-2 py-1 bg-slate-50 rounded-r-lg">
                        <div className="font-bold text-slate-800">{r.patientName}</div>
                        <div className="text-slate-500 flex justify-between items-center mt-0.5">
                          <span>{r.urgency}</span>
                          <span className="opacity-60">{r.fromFacility}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

// --- Constants & Config ---
const APP_VERSION = 2;

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  
  const statuses = [
    "Establishing secure connection...",
    "Syncing patient records...",
    "Verifying facility protocols...",
    "Loading healthcare network...",
    "Authenticating personnel...",
    "Finalizing environment..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + Math.random() * 8;
      });
    }, 150);

    const statusTimer = setInterval(() => {
      setStatusIndex(prev => (prev < statuses.length - 1 ? prev + 1 : prev));
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(statusTimer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-slate-950 overflow-hidden">
      {/* Background with slight grid/circuit feel */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
      
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-10 grayscale"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=1600&auto=format&fit=crop')` }}
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center w-full max-w-sm px-8"
      >
        <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl relative">
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <Plus className="text-white w-10 h-10 stroke-[4]" />
          </motion.div>
          <div className="absolute -inset-2 rounded-[2.5rem] border-2 border-white/5 animate-pulse" />
        </div>

        <div className="text-center space-y-2 mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white font-black text-xl uppercase tracking-[0.25em]"
          >
            Zambia Referral Pro+
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.5 }}
            className="text-blue-400 text-[9px] font-black uppercase tracking-[0.4em]"
          >
            Digital Health Infrastructure
          </motion.p>
        </div>

        <div className="w-full space-y-4">
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-linear-to-r from-red-600 to-sky-400 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            />
          </div>

          <div className="flex justify-between items-center px-0.5">
             <AnimatePresence mode="wait">
              <motion.p 
                key={statusIndex}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                className="text-slate-500 text-[10px] font-bold uppercase tracking-widest"
              >
                {statuses[statusIndex]}
              </motion.p>
            </AnimatePresence>
            <p className="text-white/20 text-[10px] font-mono">{Math.round(progress)}%</p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-16 pt-8 border-t border-white/5 w-full flex justify-center"
        >
          <div className="flex items-center gap-3 grayscale opacity-30">
             <div className="flex flex-col items-center text-center">
               <p className="text-[7px] text-white font-bold tracking-tighter uppercase leading-none mb-1">Approved Infrastructure</p>
               <p className="text-[6px] text-blue-400 font-bold tracking-widest uppercase">Zambia Health Network v{APP_VERSION}.4</p>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, setErrorState?: (msg: string | null) => void) {
  const code = (error as any)?.code;
  let userMessage = "An unexpected error occurred.";

  if (code === 'permission-denied') {
    userMessage = "Access Denied: You don't have permission to perform this action.";
  } else if (code === 'unavailable') {
    userMessage = "Network Error: Please check your internet connection and try again.";
  } else if (code === 'already-exists') {
    userMessage = "Data Conflict: This record already exists.";
  } else if (error instanceof Error) {
    userMessage = error.message;
  }

  if (setErrorState) {
    setErrorState(userMessage);
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We throw if no UI handler is provided, otherwise we let the UI handle it
  if (!setErrorState) throw new Error(JSON.stringify(errInfo));
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'emergency' | 'update' | 'info';
  timestamp: number;
  read: boolean;
  referralId?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>(Page.LOGIN);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [periodicSyncStatus, setPeriodicSyncStatus] = useState<'supported' | 'unsupported' | 'registered'>('unsupported');
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState<'supported' | 'unsupported' | 'requested'>('unsupported');
  const [allUsers, setAllUsers] = useState<(UserProfile & { id: string })[]>([]);
  const isInitialLoad = useRef(true);

  const normalizeLocation = useCallback((str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return '';
    return trimmed.toLowerCase().split(/\s+/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }, []);

  useEffect(() => {
    const checkSyncSupport = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Periodic Sync Check
        if ('periodicSync' in registration) {
          const tags = await (registration as any).periodicSync.getTags();
          setPeriodicSyncStatus(tags.includes('refresh-referrals') ? 'registered' : 'supported');
        }

        // Background Sync Check
        if ('sync' in registration) {
          setBackgroundSyncStatus('supported');
        }
      }
    };
    checkSyncSupport();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new-note' && user) {
      setPage(Page.FORM);
      // Clean up the URL to prevent re-triggering on navigation
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [user]);

  const registerBackgroundSync = async () => {
    if (backgroundSyncStatus === 'unsupported') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as any).sync.register('sync-referrals');
        setBackgroundSyncStatus('requested');
        addNotification('info', 'Background Sync Pending', 'Connectivity found. Data will be synchronized as soon as the connection is stable.');
        
        // Reset status after a delay to simulate completion (client-side only)
        setTimeout(() => setBackgroundSyncStatus('supported'), 5000);
      }
    } catch (error) {
      console.error("Background Sync registration failed:", error);
    }
  };

  const registerPeriodicSync = async () => {
    if (periodicSyncStatus === 'unsupported') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('periodicSync' in registration) {
        const status = await (navigator as any).permissions.query({
          name: 'periodic-background-sync',
        });

        if (status.state === 'granted') {
          await (registration as any).periodicSync.register('refresh-referrals', {
            minInterval: 24 * 60 * 60 * 1000, // Once a day
          });
          setPeriodicSyncStatus('registered');
          addNotification('info', 'Periodic Sync Active', 'Referral data will now be refreshed daily in the background.');
        } else {
          setGenericConfirm({
            title: "Permission Required",
            message: "Periodic Background Sync requires permission. Please ensure the app is installed to your home screen.",
            confirmText: "Understood",
            type: "info",
            onConfirm: () => {},
            icon: <RefreshCw className="w-8 h-8" />
          });
        }
      }
    } catch (error) {
      console.error("Periodic Sync registration failed:", error);
    }
  };
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setGenericConfirm({
        title: "Not Supported",
        message: "Push notifications are not supported on this browser or platform.",
        confirmText: "Understood",
        type: "warning",
        onConfirm: () => {},
        icon: <Bell className="w-8 h-8" />
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        addNotification('info', 'Notifications Enabled', 'You will now receive native alerts for critical referrals.');
        // In a real app, you'd subscribe the user to a push service here
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const addNotification = useCallback((type: 'emergency' | 'update' | 'info', title: string, message: string, referralId?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotify: Notification = {
      id,
      title,
      message,
      type,
      timestamp: Date.now(),
      read: false,
      referralId
    };
    setNotifications(prev => [newNotify, ...prev]);
  }, []);

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };
  const [submitting, setSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [outcomeInput, setOutcomeInput] = useState('');
  const [toastError, setToastError] = useState<string | null>(null);
  const [historyPatientName, setHistoryPatientName] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [genericConfirm, setGenericConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    type: "danger" | "warning" | "info" | "success";
    onConfirm: () => void;
    onCancel?: () => void;
    icon?: React.ReactNode;
  } | null>(null);
  const [transferUser, setTransferUser] = useState<(UserProfile & { id: string }) | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  // Onboarding State
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedFacility, setSelectedFacility] = useState('');
  const [customProvince, setCustomProvince] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customFacility, setCustomFacility] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('All');
  const [destFilter, setDestFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'urgency-desc' | 'urgency-asc'>('date-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'received' | 'sent' | 'all'>('received');

  // Form State
  const [destProvince, setDestProvince] = useState('');
  const [destDistrict, setDestDistrict] = useState('');
  const [destFacility, setDestFacility] = useState('');
  const [customDestProvince, setCustomDestProvince] = useState('');
  const [customDestDistrict, setCustomDestDistrict] = useState('');
  const [customDestFacility, setCustomDestFacility] = useState('');

  // Facility Search
  const [facilitySearchQuery, setFacilitySearchQuery] = useState('');
  const [showManualDestination, setShowManualDestination] = useState(false);

  const allFacilitiesList = useMemo(() => {
    const list: { province: string, district: string, facility: string }[] = [];
    for (const prov of Object.keys(ZAMBIA_DATA)) {
      for (const dist of Object.keys(ZAMBIA_DATA[prov])) {
        for (const fac of ZAMBIA_DATA[prov][dist]) {
          list.push({ province: prov, district: dist, facility: fac });
        }
      }
    }
    return list;
  }, []);

  const [formData, setFormData] = useState({
    patientName: '',
    age: '',
    sex: 'Female' as 'Male' | 'Female',
    smartCareId: '',
    reasonForReferral: '',
    diagnosis: '',
    treatmentGiven: '',
    destination: '',
    urgency: 'Routine' as 'Emergency' | 'Urgent' | 'Routine',
    bp: '',
    hr: '',
    rr: '',
    temp: '',
    spo2: '',
    gravida: '',
    parity: '',
    lmp: '',
    gestationAge: ''
  });

  // Auto-save feature
  useEffect(() => {
    if (user && page === Page.FORM) {
      // Don't auto-save if the form is completely empty (defaults)
      const hasData = Object.values(formData).some(v => v !== '' && v !== 'Female' && v !== 'Routine');
      if (!hasData) return;

      const timer = setTimeout(() => {
        localStorage.setItem(`referral_draft_${user.uid}`, JSON.stringify(formData));
      }, 1000); // Debounce save
      return () => clearTimeout(timer);
    }
  }, [formData, user, page]);

  useEffect(() => {
    if (user && page === Page.FORM) {
      const savedDraft = localStorage.getItem(`referral_draft_${user.uid}`);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          // Only offer to load if it's not empty
          const hasData = Object.values(draft).some(v => v !== '' && v !== 'Female' && v !== 'Routine');
          if (hasData) {
            setGenericConfirm({
              title: "Draft Found",
              message: "You have an unsaved referral draft. Would you like to resume where you left off or start empty?",
              confirmText: "Resume Draft",
              cancelText: "Start Fresh",
              type: "info",
              onConfirm: () => {
                setFormData(draft);
              },
              onCancel: () => {
                localStorage.removeItem(`referral_draft_${user.uid}`);
              },
              icon: <Clock className="w-8 h-8" />
            });
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [user, page]);

  useEffect(() => {
    // Validate Connection to Firestore
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
        // Connection test might fail if user is not signed in yet due to rules, which is fine
      }
    };
    testConnection();

    // Listen for version changes
    const configPath = 'system/config';
    const unsubConfig = onSnapshot(doc(db, configPath), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.version > APP_VERSION) {
          setUpdateAvailable(true);
        }
      }
    }, (error) => {
      // Don't throw for version check to avoid breaking the app if rules are restrictive
      console.warn("Version check error:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setAuthError(null);
        const userPath = `users/${u.uid}`;
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setPage(Page.DASHBOARD);
          } else {
            setPage(Page.ONBOARDING);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, userPath, setToastError);
        }
      } else {
        setPage(Page.LOGIN);
      }
      setLoading(false);
    });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubConfig();
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-prompt install when ready
  useEffect(() => {
    if (deferredPrompt && user) {
      const timer = setTimeout(() => {
        try {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choice: any) => {
            if (choice.outcome === 'accepted') {
              setDeferredPrompt(null);
            }
          });
        } catch (err) {
          console.warn('Install prompt was blocked by browser:', err);
        }
      }, 3000); // Wait 3s after login for a smoother experience
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt, user]);

  useEffect(() => {
    if (!user || page !== Page.DASHBOARD || !profile) return;

    const colPath = 'referrals';
    let q;
    
    if (isAdmin) {
      q = query(collection(db, colPath), orderBy('timestamp', 'desc'), limit(100));
    } else {
      // Fetch referrals where the current facility is either the origin or the destination
      q = query(
        collection(db, colPath), 
        or(
          where('fromFacility', '==', profile.facility),
          where('destination', '==', profile.facility)
        ),
        orderBy('timestamp', 'desc'), 
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data({ serverTimestamps: 'estimate' }) as Referral;
        const id = change.doc.id;

        if (!isInitialLoad.current) {
          if (change.type === 'added') {
            if (data.urgency === 'Emergency') {
              addNotification('emergency', 'NEW EMERGENCY REFERRAL', `${data.patientName} referred to ${data.destination}`, id);
            } else {
              addNotification('info', 'New Referral Added', `${data.patientName} listed from ${data.fromFacility}`, id);
            }
          }
          if (change.type === 'modified') {
            if (data.outcome && data.referredByUid === user.uid) {
              addNotification('update', 'Referral Update', `Update received for ${data.patientName}: ${data.outcome}`, id);
            }
          }
        }
      });

      setHasPendingWrites(snapshot.metadata.hasPendingWrites);
      const refs: Referral[] = [];
      snapshot.forEach((doc) => {
        refs.push({ id: doc.id, ...doc.data() } as Referral);
      });
      setReferrals(refs);
      isInitialLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath, setToastError);
    });

    return unsubscribe;
  }, [user, page]);

  const handleUsernameAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const input = (e.target as any).username.value.trim().toLowerCase();
    const password = (e.target as any).password.value;

    if (input.length < 3) return setAuthError("Username must be at least 3 characters.");
    if (password.length < 6) return setAuthError("Password must be at least 6 characters.");

    // If it's already an email, use it. Otherwise, append our local domain.
    const email = input.includes('@') ? input : `${input}@zambiahealth.local`;

    try {
      if (authMode === 'register') {
        const { createUserWithEmailAndPassword } = await import('./firebase');
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        const { signInWithEmailAndPassword } = await import('./firebase');
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      const errorCode = error.code || '';
      const errorMessage = error.message || '';

      if (errorCode.includes('invalid-credential') || 
          errorCode.includes('user-not-found') || 
          errorCode.includes('wrong-password') ||
          errorMessage.includes('invalid-credential')) {
        setAuthError("Invalid username or password.");
      } else if (errorCode === 'auth/email-already-in-use') {
        setAuthError("Username is already taken.");
      } else if (errorCode === 'auth/operation-not-allowed') {
        setAuthError("System Configuration Error: Please ensure 'Email/Password' is enabled in the Firebase Console.");
      } else if (errorCode === 'auth/too-many-requests') {
        setAuthError("Too many failed attempts. Please try again later.");
      } else {
        setAuthError(errorMessage || "An error occurred. Please try again.");
      }
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = (e.target as any).name.value;
    
    let province = showManualDestination ? normalizeLocation(customProvince) : selectedProvince;
    let district = showManualDestination ? normalizeLocation(customDistrict) : selectedDistrict;
    let facility = showManualDestination ? normalizeLocation(customFacility) : selectedFacility;

    // Strict search for existing facility to avoid minor duplicates
    if (showManualDestination && facility) {
      const existing = allFacilitiesList.find(f => 
        f.facility.trim().toLowerCase() === facility.toLowerCase()
      );
      if (existing) {
        province = existing.province;
        district = existing.district;
        facility = existing.facility;
      }
    }

    if (!province || !district || !facility) {
      setToastError("Please complete all location fields correctly.");
      return;
    }
    
    const newProfile: UserProfile = { 
      name, 
      facility, 
      province, 
      district, 
      role: 'staff' 
    };
    
    const userPath = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
      setPage(Page.DASHBOARD);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath, setToastError);
    }
  };

  const handleLogout = () => signOut(auth);

  const isAdmin = useMemo(() => {
    const adminIdentifiers = [
      'aspadar1234@gmail.com',
      'aspadar1234@zambiahealth.local',
      'admin@zambiahealth.local',
      'mulengapaul575@gmail.com',
      'mulengapaul575@zambiahealth.local'
    ];
    
    if (profile?.role === 'admin') return true;
    if (!user?.email) return false;
    
    const userEmail = user.email.toLowerCase();
    const usernamePart = userEmail.split('@')[0];
    
    return adminIdentifiers.includes(userEmail) || 
           usernamePart === 'aspadar1234' || 
           usernamePart === 'admin';
  }, [profile, user]);

  const groupedUsers = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, (UserProfile & { id: string })[]>>> = {};

    allUsers.forEach(u => {
      const p = normalizeLocation(u.province || 'Unspecified Province');
      const d = normalizeLocation(u.district || 'Unspecified District');
      const f = normalizeLocation(u.facility || 'Unspecified Facility');

      if (!groups[p]) groups[p] = {};
      if (!groups[p][d]) groups[p][d] = {};
      if (!groups[p][d][f]) groups[p][d][f] = [];
      
      groups[p][d][f].push(u);
    });

    return groups;
  }, [allUsers, normalizeLocation]);

  useEffect(() => {
    if (!user || !isAdmin || page !== Page.ADMIN) return;

    const colPath = 'users';
    const unsubscribe = onSnapshot(collection(db, colPath), (snapshot) => {
      const usersList: (UserProfile & { id: string })[] = [];
      snapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() } as any);
      });
      setAllUsers(usersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath, setToastError);
    });

    return unsubscribe;
  }, [user, isAdmin, page]);

  const handleDeleteReferral = async (id: string | null) => {
    if (!id) return;
    const path = `referrals/${id}`;
    try {
      await deleteDoc(doc(db, 'referrals', id));
      setDeleteConfirmId(null);
      if (selectedReferral?.id === id) {
        setSelectedReferral(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path, setToastError);
    }
  };

  const handleUpdateOutcome = async (id: string, outcome: string) => {
    const path = `referrals/${id}`;
    try {
      await updateDoc(doc(db, 'referrals', id), { 
        outcome,
        outcomeAt: serverTimestamp()
      });
      setOutcomeInput('');
      setSelectedReferral(prev => prev ? { ...prev, outcome, outcomeAt: new Date() } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, setToastError);
    }
  };

  const handleMarkAsArrived = async (id: string) => {
    const path = `referrals/${id}`;
    try {
      await updateDoc(doc(db, 'referrals', id), { 
        arrivedAt: serverTimestamp(),
        outcome: 'Arrived at Facility'
      });
      setSelectedReferral(prev => prev ? { ...prev, arrivedAt: new Date(), outcome: 'Arrived at Facility' } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, setToastError);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setToastError("User permissions updated to " + newRole.toUpperCase());
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, setToastError);
    }
  };

  const handleUpdateUserLocation = async (userId: string, province: string, district: string, facility: string) => {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), { province, district, facility });
      setTransferUser(null);
      setToastError("Staff member successfully transferred to " + facility);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, setToastError);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setToastError("User account successfully removed from the system.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path, setToastError);
    }
  };

  const uniqueDestinations = useMemo(() => {
    const dests = new Set<string>();
    referrals.forEach(r => dests.add(r.destination));
    return Array.from(dests).sort();
  }, [referrals]);

  const filteredReferrals = useMemo(() => {
    let result = referrals.filter(ref => {
      // Tab Filtering
      if (dashboardTab === 'sent') {
        const isSent = ref.referredByUid === user?.uid || ref.fromFacility === profile?.facility;
        if (!isSent) return false;
      } else if (dashboardTab === 'received') {
        const isReceived = ref.destination === profile?.facility;
        if (!isReceived) return false;
      }

      const matchesSearch = 
        ref.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.destination.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesUrgency = urgencyFilter === 'All' || ref.urgency === urgencyFilter;
      const matchesDest = destFilter === 'All' || ref.destination === destFilter;
      
      let matchesDate = true;
      if (dateFilter && ref.timestamp) {
        const refDate = ref.timestamp.toDate().toISOString().split('T')[0];
        matchesDate = refDate === dateFilter;
      }
      
      return matchesSearch && matchesUrgency && matchesDest && matchesDate;
    });

    // Handle Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'date-desc') {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      }
      if (sortBy === 'date-asc') {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeA - timeB;
      }
      if (sortBy === 'urgency-desc' || sortBy === 'urgency-asc') {
        const priority = { 'Emergency': 3, 'Urgent': 2, 'Routine': 1 };
        const scoreA = priority[a.urgency];
        const scoreB = priority[b.urgency];
        return sortBy === 'urgency-desc' ? scoreB - scoreA : scoreA - scoreB;
      }
      return 0;
    });

    return result;
  }, [referrals, searchQuery, urgencyFilter, destFilter, dateFilter, sortBy]);

  const patientHistory = useMemo(() => {
    if (!selectedReferral) return [];
    return referrals
      .filter(r => r.patientName.toLowerCase() === selectedReferral.patientName.toLowerCase() && r.id !== selectedReferral.id)
      .sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
  }, [referrals, selectedReferral]);

  const handleSubmitReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    // Resolve destination facility string
    let resolvedDestination = showManualDestination ? normalizeLocation(formData.destination) : destFacility;
    
    // Strict search for existing facility to avoid minor duplicates
    if (showManualDestination && resolvedDestination) {
      const existing = allFacilitiesList.find(f => 
        f.facility.trim().toLowerCase() === resolvedDestination.toLowerCase()
      );
      if (existing) {
        resolvedDestination = existing.facility;
      }
    }

    if (!resolvedDestination) {
      setToastError("Please provide a destination facility.");
      return;
    }

    setSubmitting(true);

    const colPath = 'referrals';
    try {
      await addDoc(collection(db, colPath), {
        patientName: formData.patientName,
        age: Number(formData.age),
        sex: formData.sex,
        smartCareId: formData.smartCareId || null,
        reasonForReferral: formData.reasonForReferral,
        diagnosis: formData.diagnosis,
        treatmentGiven: formData.treatmentGiven,
        destination: resolvedDestination,
        urgency: formData.urgency,
        vitals: {
          bp: formData.bp,
          hr: formData.hr,
          rr: formData.rr,
          temp: formData.temp,
          spo2: formData.spo2
        },
        fromFacility: profile.facility,
        referredBy: profile.name,
        referredByUid: user.uid,
        timestamp: serverTimestamp(),
        sentAt: serverTimestamp(),
        gravida: formData.sex === 'Female' ? formData.gravida || null : null,
        parity: formData.sex === 'Female' ? formData.parity || null : null,
        lmp: formData.sex === 'Female' ? formData.lmp || null : null,
        gestationAge: formData.sex === 'Female' ? formData.gestationAge || null : null
      });
      setFormData({
        patientName: '',
        age: '',
        sex: 'Female',
        smartCareId: '',
        reasonForReferral: '',
        diagnosis: '',
        treatmentGiven: '',
        destination: '',
        urgency: 'Routine',
        bp: '',
        hr: '',
        rr: '',
        temp: '',
        spo2: '',
        gravida: '',
        parity: '',
        lmp: '',
        gestationAge: ''
      });
      localStorage.removeItem(`referral_draft_${user.uid}`);
      setDestProvince('');
      setDestDistrict('');
      setDestFacility('');
      setCustomDestProvince('');
      setCustomDestDistrict('');
      setCustomDestFacility('');
      setPage(Page.DASHBOARD);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, colPath, setToastError);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative font-sans text-slate-900 pb-24 overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
        {/* Background Image with Overlay */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=1600&auto=format&fit=crop')`,
            backgroundColor: '#f8fafc',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative z-10">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-blue-500 text-white px-6 py-4 shadow-lg flex justify-between items-center bg-linear-to-r from-blue-500 to-sky-500">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-3 font-display">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                <Plus className="text-red-600 w-5 h-5 md:w-6 md:h-6 stroke-[4]" />
              </div>
              Zambia Referral Pro+
              {isAdmin && (
                <span className="bg-purple-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest translate-y-[1px]">Admin</span>
              )}
            </h1>
            <div className="flex items-center gap-2">
              {profile && <p className="text-xs opacity-80 font-medium">{profile.facility}</p>}
              <SyncStatus isOffline={isOffline} hasPendingWrites={hasPendingWrites} />
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowNotifications(true)}
                className="relative p-2 hover:bg-blue-600 rounded-lg transition-colors group"
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-white/90 group-hover:text-white" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-blue-700 shadow-lg">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              <button 
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const docSnap = await getDoc(doc(db, 'system', 'config'));
                    if (docSnap.exists()) {
                      const data = docSnap.data();
                      if (data.version > APP_VERSION) {
                        setUpdateAvailable(true);
                        setGenericConfirm({
                          title: "Update Available!",
                          message: "A new version of Zambia Referral Pro+ is ready. View your profile to install the latest features.",
                          confirmText: "Go to Profile",
                          type: "success",
                          onConfirm: () => setPage(Page.PROFILE),
                          icon: <CheckCircle2 className="w-8 h-8" />
                        });
                      } else {
                        setGenericConfirm({
                          title: "Up to Date",
                          message: "You are running the latest version of the platform.",
                          confirmText: "Okay",
                          type: "info",
                          onConfirm: () => {},
                          icon: <CheckCircle2 className="w-8 h-8" />
                        });
                      }
                    }
                  } catch(e) {
                    console.error("Manual update check failed", e);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className={cn("p-2 hover:bg-blue-600 rounded-lg transition-colors", submitting && "animate-spin")}
                title="Check for updates"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} className="p-2 hover:bg-blue-600 rounded-lg transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </header>

        <OfflineBanner isOffline={isOffline} hasPendingWrites={hasPendingWrites} />

        <ConfirmationModal 
          isOpen={!!deleteConfirmId}
          title="Delete Referral?"
          message="This will permanently remove this referral from the system. This action is irreversible."
          onConfirm={() => handleDeleteReferral(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
          confirmText="Confirm Deletion"
        />

        <ConfirmationModal 
          isOpen={!!genericConfirm}
          title={genericConfirm?.title || ""}
          message={genericConfirm?.message || ""}
          onConfirm={() => {
            genericConfirm?.onConfirm();
            setGenericConfirm(null);
          }}
          onCancel={() => {
            if (genericConfirm?.onCancel) genericConfirm.onCancel();
            setGenericConfirm(null);
          }}
          confirmText={genericConfirm?.confirmText || "Confirm"}
          cancelText={genericConfirm?.cancelText || "Cancel"}
          type={genericConfirm?.type || "info"}
          icon={genericConfirm?.icon}
        />

        <AnimatePresence>
          {showNotifications && (
            <NotificationCenter 
              notifications={notifications}
              onClose={() => setShowNotifications(false)}
              onMarkAsRead={markNotificationRead}
              onClearAll={clearNotifications}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {historyPatientName && (
            <HistoryModal 
              patientName={historyPatientName} 
              referrals={referrals} 
              onClose={() => setHistoryPatientName(null)} 
            />
          )}
        </AnimatePresence>

        <main className="max-w-2xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {page === Page.LOGIN && (
              <motion.div 
                key="login"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <div className="w-16 h-16 bg-white border-2 border-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                    <Plus className="text-white w-8 h-8 stroke-[4]" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2 font-display tracking-tight">
                  {authMode === 'register' ? 'Create Account' : 'Facility Access'}
                </h2>
                <p className="text-slate-500 text-center mb-8 max-w-xs text-sm">
                  {authMode === 'register' 
                    ? 'Register your facility account to join the network.' 
                    : 'Securely access the national health referral network.'}
                </p>

                {authError && (
                  <div className="w-full max-w-xs mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {authError}
                  </div>
                )}

                {authMode === 'login' || authMode === 'register' ? (
                  <form onSubmit={handleUsernameAuth} className="w-full max-w-xs space-y-4">
                    <input 
                      name="username" 
                      required 
                      placeholder="Username"
                      className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <input 
                      name="password" 
                      type="password"
                      required 
                      placeholder="Password"
                      className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-sky-100 transition-all">
                      {authMode === 'register' ? 'Sign Up' : 'Sign In'}
                    </button>
                  </form>
                ) : null}

                <div className="mt-8 flex flex-col items-center gap-4">
                  <div className="flex gap-4">
                    {authMode !== 'login' && (
                      <button 
                        onClick={() => { setAuthMode('login'); setAuthError(null); }}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Back to Login
                      </button>
                    )}
                    {authMode === 'login' && (
                      <button 
                        onClick={() => { setAuthMode('register'); setAuthError(null); }}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Create Username Account
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {page === Page.ONBOARDING && (
              <motion.div 
                key="onboarding"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
              >
                <h2 className="text-xl font-bold mb-6">Complete Your Profile</h2>
                <form onSubmit={handleOnboarding} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                    <input 
                      name="name" 
                      required 
                      placeholder="Dr. John Doe"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Facility Search Setup */}
                  {!showManualDestination && (
                    <div className="relative">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Your Facility</label>
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                          type="text"
                          placeholder="Search your facility..."
                          value={facilitySearchQuery}
                          onChange={(e) => {
                            setFacilitySearchQuery(e.target.value);
                            if (selectedFacility) {
                              setSelectedFacility(''); 
                            }
                          }}
                          className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                        />
                        {facilitySearchQuery && (
                          <button 
                            type="button"
                            onClick={() => {
                              setFacilitySearchQuery('');
                              setSelectedFacility('');
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        )}
                      </div>

                      {facilitySearchQuery && !selectedFacility && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-[300px] overflow-y-auto">
                          {allFacilitiesList
                            .filter(f => 
                              f.facility.toLowerCase().includes(facilitySearchQuery.toLowerCase()) || 
                              f.district.toLowerCase().includes(facilitySearchQuery.toLowerCase())
                            )
                            .slice(0, 15)
                            .map((item, idx) => (
                              <button
                                key={`${item.facility}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setFacilitySearchQuery(item.facility);
                                  setSelectedProvince(item.province);
                                  setSelectedDistrict(item.district);
                                  setSelectedFacility(item.facility);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex flex-col"
                              >
                                <span className="font-bold text-slate-800">{item.facility}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{item.district}, {item.province} Province</span>
                              </button>
                          ))}
                          <div className="p-3 bg-slate-50 border-t border-slate-100">
                            <p className="text-xs text-slate-500 text-center">
                              Can't find it? <button type="button" onClick={() => setShowManualDestination(true)} className="text-blue-600 font-bold hover:underline">Enter manually</button>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual Entry Fallback */}
                  {showManualDestination && (
                    <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-slate-800">Manual Entry</h4>
                        <button 
                          type="button" 
                          onClick={() => {
                            setShowManualDestination(false);
                            setCustomProvince('');
                            setCustomDistrict('');
                            setCustomFacility('');
                          }}
                          className="text-xs text-blue-600 font-bold hover:bg-blue-50 px-2 py-1 rounded-lg"
                        >
                          Back to Search
                        </button>
                      </div>
                      
                      <input 
                        placeholder="Province"
                        value={customProvince}
                        onChange={e => setCustomProvince(e.target.value)}
                        className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input 
                        placeholder="District"
                        value={customDistrict}
                        onChange={e => setCustomDistrict(e.target.value)}
                        className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input 
                        placeholder="Facility Name (e.g. UTH)"
                        value={customFacility}
                        onChange={e => setCustomFacility(e.target.value)}
                        className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}

                  <button className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-sky-100 transition-all mt-4">
                    Finish Setup
                  </button>
                </form>
              </motion.div>
            )}

            {page === Page.DASHBOARD && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {updateAvailable && (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="text-emerald-800 font-bold text-sm">New Update Available!</h3>
                      <p className="text-emerald-600 text-xs mt-0.5">We've added new features and improvements.</p>
                    </div>
                    <button 
                      onClick={async () => {
                        if ('caches' in window) {
                          try {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(k => caches.delete(k)));
                          } catch(e) {}
                        }
                        window.location.reload();
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer hover:bg-emerald-700 transition"
                    >
                      Update App
                    </button>
                  </div>
                )}

                {deferredPrompt ? (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-blue-800 font-bold text-sm">Install App</h3>
                        <p className="text-blue-600 text-xs mt-0.5">Install on your home screen for offline access.</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                          setDeferredPrompt(null);
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer hover:bg-blue-600 transition"
                    >
                      Install
                    </button>
                  </div>
                ) : !window.matchMedia('(display-mode: standalone)').matches && (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-200 text-slate-600 rounded-xl">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-slate-800 font-bold text-sm">Install as App</h3>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          Tap the browser's menu (⋮) or Share icon (⎙) and select <b>"Add to Home Screen"</b> to install.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Welcome back,</p>
                    <h2 className="text-2xl font-display font-bold text-slate-900 leading-none">{profile?.name}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={async () => {
                        if ('caches' in window) {
                          try {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(k => caches.delete(k)));
                          } catch(e) {}
                        }
                        window.location.reload();
                      }}
                      className="p-3 bg-white text-slate-500 rounded-lg shadow-sm hover:bg-slate-50 transition-colors border border-slate-200"
                      title="Fetch Latest Updates"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setPage(Page.FORM)}
                      className="bg-blue-500 text-white p-3 rounded-lg shadow hover:bg-blue-600 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-wide hidden sm:inline">New Referral</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter UI */}
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative group flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text"
                        placeholder="Search patient or destination..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-lg shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={cn(
                        "p-3 rounded-lg border transition-all flex items-center justify-center relative",
                        showFilters || urgencyFilter !== 'All' || destFilter !== 'All' || dateFilter 
                          ? "bg-blue-50 border-blue-200 text-blue-600" 
                          : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <Filter className="w-5 h-5" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
                          {/* Urgency Filter */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Urgency Level</label>
                            <div className="flex flex-wrap gap-2">
                              {['All', 'Emergency', 'Urgent', 'Routine'].map((filter) => (
                                <button
                                  key={filter}
                                  onClick={() => setUrgencyFilter(filter)}
                                  className={cn(
                                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all border",
                                    urgencyFilter === filter
                                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                  )}
                                >
                                  {filter}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Destination & Date */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Destination Facility</label>
                              <div className="relative">
                                <Hospital className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                  value={destFilter}
                                  onChange={(e) => setDestFilter(e.target.value)}
                                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                  <option value="All">All Facilities</option>
                                  {uniqueDestinations.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">By Date</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                  type="date"
                                  value={dateFilter}
                                  onChange={(e) => setDateFilter(e.target.value)}
                                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                {dateFilter && (
                                  <button 
                                    onClick={() => setDateFilter('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                                  >
                                    <X className="w-3 h-3 text-slate-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Sorting */}
                          <div className="space-y-2 pt-2 border-t border-slate-50">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sort Referrals</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => setSortBy(sortBy === 'date-desc' ? 'date-asc' : 'date-desc')}
                                className={cn(
                                  "flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-bold transition-all",
                                  sortBy.startsWith('date') ? "bg-blue-500 border-blue-500 text-white shadow-md shadow-sky-100" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>TIME: {sortBy === 'date-desc' ? 'NEWEST FIRST' : 'OLDEST FIRST'}</span>
                                </div>
                                <ArrowUpDown className="w-3 h-3 opacity-60" />
                              </button>
                              <button 
                                onClick={() => setSortBy(sortBy === 'urgency-desc' ? 'urgency-asc' : 'urgency-desc')}
                                className={cn(
                                  "flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-bold transition-all",
                                  sortBy.startsWith('urgency') ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-100" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>URGENCY: {sortBy === 'urgency-desc' ? 'HIGH TO LOW' : 'LOW TO HIGH'}</span>
                                </div>
                                <ArrowUpDown className="w-3 h-3 opacity-60" />
                              </button>
                            </div>
                          </div>

                          {/* Reset Button */}
                          {(urgencyFilter !== 'All' || destFilter !== 'All' || dateFilter || searchQuery) && (
                            <button 
                              onClick={() => {
                                setUrgencyFilter('All');
                                setDestFilter('All');
                                setDateFilter('');
                                setSearchQuery('');
                                setSortBy('date-desc');
                              }}
                              className="w-full py-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Reset All Filters
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!showFilters && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <div className="flex-shrink-0 p-2 bg-slate-100 rounded-md">
                        <LayoutGrid className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex gap-2">
                        {['All', 'Emergency', 'Urgent', 'Routine'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setUrgencyFilter(f)}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-bold border transition-all",
                              urgencyFilter === f
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-300 text-slate-500"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sentiment Tabs */}
                <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <button 
                    onClick={() => setDashboardTab('received')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                      dashboardTab === 'received' ? "bg-blue-500 text-white shadow-lg shadow-sky-100" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    Incoming
                    {referrals.filter(r => r.destination === profile?.facility).length > 0 && (
                      <span className={cn(
                        "ml-1 px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center",
                        dashboardTab === 'received' ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                      )}>
                        {referrals.filter(r => r.destination === profile?.facility).length}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => setDashboardTab('sent')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                      dashboardTab === 'sent' ? "bg-blue-500 text-white shadow-lg shadow-sky-100" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <LogOut className="w-4 h-4 rotate-180" />
                    Outgoing
                    {referrals.filter(r => r.referredByUid === user?.uid || r.fromFacility === profile?.facility).length > 0 && (
                      <span className={cn(
                        "ml-1 px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center",
                        dashboardTab === 'sent' ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                      )}>
                        {referrals.filter(r => r.referredByUid === user?.uid || r.fromFacility === profile?.facility).length}
                      </span>
                    )}
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setDashboardTab('all')}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                        dashboardTab === 'all' ? "bg-purple-600 text-white shadow-lg shadow-purple-100" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <Globe className="w-4 h-4" />
                      All Network
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between px-2 pt-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                    {dashboardTab === 'received' ? 'Received Referrals' : dashboardTab === 'sent' ? 'Sent Referrals' : 'Global Network Feed'}
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">{filteredReferrals.length} Items</span>
                </div>

                <div className="space-y-4">
                  {filteredReferrals.length === 0 ? (
                    <EmptyState 
                      icon={searchQuery || urgencyFilter !== 'All' ? FilterX : ClipboardList}
                      title={searchQuery || urgencyFilter !== 'All' ? "No results found" : "No referrals yet"}
                      description={searchQuery || urgencyFilter !== 'All' 
                        ? "Try adjusting your filters or search query to find what you're looking for." 
                        : "There are currently no active referrals. Start by creating a new referral entry."}
                      action={
                        searchQuery || urgencyFilter !== 'All' ? (
                          <button 
                            onClick={() => {
                              setUrgencyFilter('All');
                              setSearchQuery('');
                              setDestFilter('All');
                              setDateFilter('');
                            }}
                            className="bg-blue-500 text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-sky-100 hover:scale-105 transition-transform"
                          >
                            Reset all filters
                          </button>
                        ) : (
                          <button 
                            onClick={() => setPage(Page.FORM)}
                            className="bg-blue-500 text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-sky-100 hover:scale-105 transition-transform flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            New Referral
                          </button>
                        )
                      }
                      className="bg-white rounded-[2rem] border-2 border-dashed border-slate-100 shadow-sm"
                    />
                  ) : (
                    filteredReferrals.map((ref) => (
                      <motion.div 
                        layout
                        key={ref.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          setSelectedReferral(ref);
                          setOutcomeInput(ref.outcome || '');
                        }}
                        className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 relative overflow-hidden group hover:border-blue-300 transition-colors cursor-pointer"
                      >
                        <div className={cn(
                          "absolute top-0 left-0 w-1 h-full",
                          ref.urgency === 'Emergency' ? 'bg-red-600' : 
                          ref.urgency === 'Urgent' ? 'bg-orange-500' : 'bg-emerald-600'
                        )} />
                        
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900 text-base">{ref.patientName}</h4>
                            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-semibold mt-0.5 uppercase tracking-wider">
                              <span>{ref.age} Years</span>
                              <span>•</span>
                              <span>{ref.sex}</span>
                              {ref.sentAt && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(ref.sentAt?.toDate?.() || ref.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
                            ref.urgency === 'Emergency' ? 'bg-red-50 text-red-700 border-red-200' : 
                            ref.urgency === 'Urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          )}>
                            {ref.urgency}
                          </span>
                        </div>

                        {ref.vitals && (
                          <div className="grid grid-cols-5 gap-1 mt-3 mb-3">
                            {ref.vitals.bp && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">BP</p>
                                <p className="text-[10px] font-bold text-slate-700">{ref.vitals.bp}</p>
                              </div>
                            )}
                            {ref.vitals.hr && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">HR</p>
                                <p className="text-[10px] font-bold text-slate-700">{ref.vitals.hr}</p>
                              </div>
                            )}
                            {ref.vitals.rr && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">RR</p>
                                <p className="text-[10px] font-bold text-slate-700">{ref.vitals.rr}</p>
                              </div>
                            )}
                            {ref.vitals.temp && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">Temp</p>
                                <p className="text-[10px] font-bold text-slate-700">{ref.vitals.temp}°C</p>
                              </div>
                            )}
                            {ref.vitals.spo2 && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                                <p className="text-[8px] text-slate-400 font-bold uppercase">SpO2</p>
                                <p className="text-[10px] font-bold text-slate-700">{ref.vitals.spo2}%</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium">To: {ref.destination}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Hospital className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium">From: {ref.fromFacility}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-50 flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-slate-400 font-medium italic">By {ref.referredBy}</p>
                            {ref.arrivedAt && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3" />
                                {ref.outcome && ref.outcome !== 'Arrived at Facility' ? 'COMPLETED' : 'ARRIVED'}
                              </div>
                            )}
                          </div>
                          <div className="w-full flex gap-2">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedReferral(ref);
                                 setOutcomeInput(ref.outcome || '');
                               }}
                               className="flex-1 py-2.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                             >
                               View Details
                               <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setHistoryPatientName(ref.patientName);
                               }}
                               className="px-4 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                               title="Referral History"
                             >
                               <History className="w-4 h-4" />
                               History
                             </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {page === Page.FORM && (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl shadow-lg border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-blue-50 rounded-md">
                    <Plus className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">New Referral</h2>
                </div>

                <form onSubmit={handleSubmitReferral} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient Identification</h3>
                    <div className="space-y-4">
                      <div className="relative group">
                        <input 
                          type="text" 
                          placeholder="SmartCare ID (Optional)"
                          value={formData.smartCareId}
                          onChange={e => setFormData({...formData, smartCareId: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none pr-12 font-mono text-xs transition-all focus:bg-white"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (!formData.smartCareId) {
                              setToastError("Please enter a SmartCare ID to perform a lookup.");
                              return;
                            }
                            setSubmitting(true);
                            // Simulated SmartCare API Lookup
                            setTimeout(() => {
                              setSubmitting(false);
                              if (formData.smartCareId === 'SC-123') {
                                setFormData({
                                  ...formData,
                                  patientName: 'Jane Mulenga Cooper',
                                  age: '32',
                                  sex: 'Female'
                                });
                                setToastError(null);
                                setGenericConfirm({
                                  title: "SmartCare Sync Successful",
                                  message: "Patient 'Jane Mulenga Cooper' found and data populated automatically.",
                                  confirmText: "Great",
                                  type: "success",
                                  onConfirm: () => {},
                                  icon: <CheckCircle2 className="w-8 h-8" />
                                });
                              } else {
                                setToastError("Patient ID '"+formData.smartCareId+"' not found in SmartCare Zambia directory.");
                              }
                            }, 1500);
                          }}
                          className={cn(
                            "absolute right-1.5 top-1.5 p-2 rounded-md transition-all shadow-sm active:scale-90",
                            formData.smartCareId ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          )}
                          title="Lookup in SmartCare Zambia"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", submitting && "animate-spin")} />
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          required
                          placeholder="Full Patient Name"
                          value={formData.patientName}
                          onChange={e => setFormData({...formData, patientName: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        <UserIcon className="absolute right-4 top-4 w-5 h-5 text-slate-300" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        required
                        type="number"
                        placeholder="Age"
                        value={formData.age}
                        onChange={e => setFormData({...formData, age: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <select 
                        value={formData.sex}
                        onChange={e => setFormData({...formData, sex: e.target.value as any})}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option>Female</option>
                        <option>Male</option>
                      </select>
                    </div>

                    <AnimatePresence>
                      {formData.sex === 'Female' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 pt-2 border-t border-slate-50 overflow-hidden"
                        >
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Obstetric History</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <input 
                              placeholder="Gravida"
                              value={formData.gravida}
                              onChange={e => setFormData({...formData, gravida: e.target.value})}
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <input 
                              placeholder="Parity"
                              value={formData.parity}
                              onChange={e => setFormData({...formData, parity: e.target.value})}
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                              <input 
                                type="date"
                                value={formData.lmp}
                                onChange={e => setFormData({...formData, lmp: e.target.value})}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder:opacity-0"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">LMP</div>
                            </div>
                            <div className="relative">
                              <input 
                                placeholder="Gestation Age (Weeks)"
                                value={formData.gestationAge}
                                onChange={e => setFormData({...formData, gestationAge: e.target.value})}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vital Signs</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        placeholder="BP (e.g. 120/80)"
                        value={formData.bp}
                        onChange={e => setFormData({...formData, bp: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input 
                        type="number"
                        placeholder="HR (bpm)"
                        value={formData.hr}
                        onChange={e => setFormData({...formData, hr: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input 
                        type="number"
                        placeholder="RR (bpm)"
                        value={formData.rr}
                        onChange={e => setFormData({...formData, rr: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input 
                        type="number"
                        step="0.1"
                        placeholder="Temp (°C)"
                        value={formData.temp}
                        onChange={e => setFormData({...formData, temp: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <input 
                      type="number"
                      placeholder="SpO2 (%)"
                      value={formData.spo2}
                      onChange={e => setFormData({...formData, spo2: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clinical Info</h3>
                    <textarea 
                      required
                      placeholder="Diagnosis / Impression"
                      rows={2}
                      value={formData.diagnosis}
                      onChange={e => setFormData({...formData, diagnosis: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                    <textarea 
                      required
                      placeholder="Treatment Given"
                      rows={2}
                      value={formData.treatmentGiven}
                      onChange={e => setFormData({...formData, treatmentGiven: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                    <textarea 
                      required
                      placeholder="Reason for Referral"
                      rows={2}
                      value={formData.reasonForReferral}
                      onChange={e => setFormData({...formData, reasonForReferral: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transfer Details</h3>
                    
                    {/* Destination Search */}
                    {!showManualDestination && (
                      <div className="relative">
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <input 
                            type="text"
                            placeholder="Search destination facility..."
                            value={facilitySearchQuery}
                            onChange={(e) => {
                              setFacilitySearchQuery(e.target.value);
                              if (destFacility) {
                                setDestFacility(''); // reset selected if they start typing again
                                setFormData({...formData, destination: ''});
                              }
                            }}
                            className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                          />
                          {facilitySearchQuery && (
                            <button 
                              type="button"
                              onClick={() => setFacilitySearchQuery('')}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                            >
                              <X className="w-4 h-4 text-slate-400" />
                            </button>
                          )}
                        </div>

                        {/* Search Results Dropdown */}
                        {facilitySearchQuery && !destFacility && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-[300px] overflow-y-auto">
                            {allFacilitiesList
                              .filter(f => 
                                f.facility.toLowerCase().includes(facilitySearchQuery.toLowerCase()) || 
                                f.district.toLowerCase().includes(facilitySearchQuery.toLowerCase())
                              )
                              .slice(0, 15)
                              .map((item, idx) => (
                                <button
                                  key={`${item.facility}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setFacilitySearchQuery(item.facility);
                                    setDestProvince(item.province);
                                    setDestDistrict(item.district);
                                    setDestFacility(item.facility);
                                    setFormData({...formData, destination: ''});
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex flex-col"
                                >
                                  <span className="font-bold text-slate-800">{item.facility}</span>
                                  <span className="text-[10px] text-slate-500 font-medium">{item.district}, {item.province} Province</span>
                                </button>
                            ))}
                            <div className="p-3 bg-slate-50 border-t border-slate-100">
                              <p className="text-xs text-slate-500 text-center">
                                Can't find it? <button type="button" onClick={() => setShowManualDestination(true)} className="text-blue-600 font-bold hover:underline">Enter manually</button>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manual Destination Fallback */}
                    {showManualDestination && (
                      <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-sm font-bold text-slate-800">Manual Entry</h4>
                          <button 
                            type="button" 
                            onClick={() => {
                              setShowManualDestination(false);
                              setFormData({...formData, destination: ''});
                            }}
                            className="text-xs text-blue-600 font-bold hover:bg-blue-50 px-2 py-1 rounded-lg"
                          >
                            Back to Search
                          </button>
                        </div>
                        <input 
                          placeholder="Type Destination Facility Name"
                          value={formData.destination}
                          onChange={e => setFormData({...formData, destination: e.target.value})}
                          className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {(['Routine', 'Urgent', 'Emergency'] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setFormData({...formData, urgency: u})}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-bold uppercase transition-all border",
                            formData.urgency === u 
                              ? u === 'Emergency' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100' :
                                u === 'Urgent' ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' :
                                'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100'
                              : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setPage(Page.DASHBOARD)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={submitting}
                      className="flex-[2] py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-sky-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 transition-transform group-hover:translate-x-1" />}
                      Send Referral
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
            {page === Page.MAP && (
              <motion.div 
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">Referral Map</h2>
                    <p className="text-sm text-slate-500 font-medium">Visualizing facility load across Zambia</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <MapIcon className="w-6 h-6" />
                  </div>
                </div>
                
                <MapView referrals={referrals} onAction={() => setPage(Page.FORM)} />

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
                  <p className="text-xs text-slate-500 font-medium italic">
                    Map markers show hospitals with incoming referrals. Click a marker to view patient details.
                  </p>
                </div>
              </motion.div>
            )}

            {page === Page.ADMIN && isAdmin && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-50 rounded-2xl">
                      <ShieldCheck className="w-6 h-6 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-bold">Admin Dashboard</h2>
                  </div>

                  <div className="space-y-6">
                    <section>
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">User Management</h3>
                      </div>
                      <div className="space-y-6">
                        {Object.entries(groupedUsers || {}).sort().map(([province, districts]) => (
                          <div key={province} className="space-y-4">
                            <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-lg">
                              <MapPin className="w-3 h-3 text-blue-600" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{province}</span>
                            </div>
                            
                            <div className="ml-4 space-y-4">
                              {Object.entries(districts || {}).sort().map(([district, facilities]) => (
                                <div key={district} className="space-y-3">
                                  <div className="flex items-center gap-2 border-l-2 border-slate-200 pl-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{district} District</span>
                                  </div>

                                  <div className="ml-2 space-y-3">
                                    {Object.entries(facilities || {}).sort().map(([facility, staff]) => (
                                      <div key={facility} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Hospital className="w-3 h-3 text-slate-300" />
                                          <span className="text-[11px] font-bold text-slate-500">{facility}</span>
                                          <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black">{(staff as any[]).length}</span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                          {(staff as any[]).map((u) => (
                                            <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                              <div>
                                                <p className="font-bold text-xs">{u.name}</p>
                                                <p className="text-[9px] text-slate-400 font-medium">{u.role?.toUpperCase() || 'STAFF'}</p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <select 
                                                  value={u.role || 'staff'}
                                                  onChange={(e) => {
                                                    const newRole = e.target.value;
                                                    setGenericConfirm({
                                                      title: "Update User Role?",
                                                      message: `Are you sure you want to change ${u.name}'s permissions to ${newRole.toUpperCase()}?`,
                                                      confirmText: "Change Role",
                                                      type: "warning",
                                                      onConfirm: () => handleUpdateUserRole(u.id, newRole)
                                                    });
                                                  }}
                                                  className="text-[10px] font-black bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none"
                                                >
                                                  <option value="staff">Staff</option>
                                                  <option value="admin">Admin</option>
                                                </select>
                                                <button 
                                                  onClick={() => {
                                                    setTransferUser(u);
                                                    setSelectedProvince(u.province || '');
                                                    setSelectedDistrict(u.district || '');
                                                    setSelectedFacility(u.facility || '');
                                                    setShowManualDestination(false);
                                                  }}
                                                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                  title="Transfer Facility"
                                                >
                                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    setGenericConfirm({
                                                      title: "Delete User Account?",
                                                      message: `Warning: This will permanently remove ${u.name}'s account from the database. This action cannot be undone.`,
                                                      confirmText: "Delete Permanently",
                                                      type: "danger",
                                                      onConfirm: () => handleDeleteUser(u.id)
                                                    });
                                                  }}
                                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                  title="Delete User"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <Hospital className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">System Updates</h3>
                      </div>
                      <button 
                        onClick={() => {
                          setGenericConfirm({
                            title: "Broadcast Update?",
                            message: "This will notify all active clients that a major maintenance update is available for installation.",
                            confirmText: "Broadcast Now",
                            type: "info",
                            onConfirm: async () => {
                              try {
                                await setDoc(doc(db, 'system', 'config'), { version: APP_VERSION + 1 }, { merge: true });
                                setToastError("Update notification successfully broadcasted.");
                              } catch(e) {
                                setToastError("Failed to broadcast update.");
                              }
                            },
                            icon: <Cloud className="w-8 h-8" />
                          });
                        }}
                        className="w-full py-4 bg-emerald-600 text-white text-sm font-black rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition active:scale-95 border-b-4 border-emerald-800"
                      >
                        Notify Users of Update
                      </button>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Referral Cleanup</h3>
                      </div>
                      <div className="space-y-3">
                        {referrals.map((ref) => (
                          <div 
                            key={ref.id} 
                            onClick={() => setSelectedReferral(ref)}
                            className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-blue-200 transition-colors group flex flex-col gap-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0 mr-4">
                                <p className="font-bold text-sm truncate">{ref.patientName}</p>
                                <p className="text-[10px] text-slate-500 truncate">{ref.fromFacility} → {ref.destination}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(ref.id);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                title="Delete Referral"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex gap-2 w-full mt-1">
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedReferral(ref);
                                   setOutcomeInput(ref.outcome || '');
                                 }}
                                 className="flex-1 py-2 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"
                               >
                                 View Details
                                 <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                               </button>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setHistoryPatientName(ref.patientName);
                                 }}
                                 className="px-3 py-2 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 hover:bg-slate-100 transition-colors"
                                 title="Referral History"
                                >
                                 <History className="w-3 h-3" />
                                 Hist
                               </button>
                             </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}
            {page === Page.DIRECTORY && (
              <motion.div 
                key="directory"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <FacilityDirectory />
              </motion.div>
            )}
            {page === Page.PROFILE && profile && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                  <div className="flex flex-col items-center mb-8 text-center">
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 relative">
                      <UserIcon className="w-12 h-12 text-blue-600" />
                      {updateAvailable && (
                        <span className="absolute top-0 right-0 flex h-6 w-6">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-6 w-6 bg-emerald-500 border-2 border-white"></span>
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{profile.name}</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mt-1">{profile.role}</p>
                    <div className="mt-4 px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-black rounded-full border border-blue-100 max-w-[200px] truncate">
                      {profile.facility}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Native Capabilities Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "p-2 rounded-xl border shadow-sm",
                            backgroundSyncStatus === 'requested' ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-white border-slate-200 text-slate-400"
                          )}>
                            <RefreshCw className={cn("w-5 h-5", backgroundSyncStatus === 'requested' && "animate-spin")} />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Background Sync</p>
                            <p className="text-xs font-bold text-slate-700">
                              {backgroundSyncStatus === 'requested' ? "Syncing..." : 
                               backgroundSyncStatus === 'unsupported' ? "Not Supported" : "Standard Sync Ready"}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={registerBackgroundSync}
                          disabled={backgroundSyncStatus !== 'supported'}
                          className={cn(
                            "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                            backgroundSyncStatus === 'requested' 
                              ? "bg-blue-50 text-blue-600 animate-pulse cursor-default" 
                              : backgroundSyncStatus === 'unsupported'
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
                          )}
                        >
                          {backgroundSyncStatus === 'requested' ? "SYNCING..." : 
                           backgroundSyncStatus === 'unsupported' ? "INACTIVE" : "FORCE SYNC"}
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "p-2 rounded-xl border shadow-sm",
                            periodicSyncStatus === 'registered' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-white border-slate-200 text-slate-400"
                          )}>
                            <RotateCw className={cn("w-5 h-5", periodicSyncStatus === 'registered' && "animate-[spin_10s_linear_infinite]")} />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Auto Refresh</p>
                            <p className="text-xs font-bold text-slate-700">
                              {periodicSyncStatus === 'registered' ? "Daily Sync Enabled" : 
                               periodicSyncStatus === 'unsupported' ? "Not Supported" : "Sync Available"}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={registerPeriodicSync}
                          disabled={periodicSyncStatus !== 'supported'}
                          className={cn(
                            "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                            periodicSyncStatus === 'registered' 
                              ? "bg-emerald-100 text-emerald-700 cursor-default" 
                              : periodicSyncStatus === 'unsupported'
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
                          )}
                        >
                          {periodicSyncStatus === 'registered' ? "ACTIVE" : 
                           periodicSyncStatus === 'unsupported' ? "LIMITED ACCESS" : "ACTIVATE"}
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "p-2 rounded-xl border shadow-sm",
                            notificationPermission === 'granted' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-white border-slate-200 text-slate-400"
                          )}>
                            <Bell className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Push Alerts</p>
                            <p className="text-xs font-bold text-slate-700">
                              {notificationPermission === 'granted' ? "Notifications Active" : 
                               notificationPermission === 'denied' ? "Alerts Blocked" : "Alerts Requested"}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={requestNotificationPermission}
                          disabled={notificationPermission === 'granted'}
                          className={cn(
                            "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                            notificationPermission === 'granted' 
                              ? "bg-slate-200 text-slate-400 cursor-default" 
                              : "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
                          )}
                        >
                          {notificationPermission === 'granted' ? "PERMISSION GRANTED" : "ENABLE NOTIFICATIONS"}
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm">
                            <span className={cn(
                              "flex w-5 h-5 items-center justify-center font-black text-xs",
                              isOffline ? "text-amber-500" : "text-emerald-500"
                            )}>
                              {isOffline ? "!" : "OK"}
                            </span>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">SW Status</p>
                            <p className="text-xs font-bold text-slate-700">
                              {isOffline ? "Running Offline" : "Service Worker Active"}
                            </p>
                          </div>
                        </div>
                        <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-200 rounded-xl">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            isOffline ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                          )} />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            {isOffline ? "LOCAL CACHE MODE" : "READY TO SYNC"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Platform Version</p>
                            <p className="text-sm font-black text-slate-800 tracking-tight">v{APP_VERSION}.0.0.release</p>
                          </div>
                        </div>
                        {updateAvailable && (
                          <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black rounded-lg animate-bounce uppercase tracking-widest">
                            New
                          </div>
                        )}
                      </div>
                      
                      {updateAvailable ? (
                        <button 
                          onClick={async () => {
                            if ('caches' in window) {
                              try {
                                const keys = await caches.keys();
                                await Promise.all(keys.map(k => caches.delete(k)));
                              } catch(e) {}
                            }
                            window.location.reload();
                          }}
                          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-emerald-800"
                        >
                          <RefreshCw className="w-5 h-5 animate-spin-slow" />
                          UPDATE NEW FEATURES
                        </button>
                      ) : (
                        <button 
                          onClick={async () => {
                            setSubmitting(true);
                            try {
                              const docSnap = await getDoc(doc(db, 'system', 'config'));
                              if (docSnap.exists() && docSnap.data().version > APP_VERSION) {
                                setUpdateAvailable(true);
                                setGenericConfirm({
                                  title: "Major Update Found!",
                                  message: "A new version of the platform with optimized features has been detected. You can now install it via your profile.",
                                  confirmText: "Install Now",
                                  type: "success",
                                  onConfirm: () => {},
                                  icon: <Gift className="w-8 h-8" />
                                });
                              } else {
                                setGenericConfirm({
                                  title: "System Optimized",
                                  message: `Your application is currently running at the peak version (v${APP_VERSION}.0). No new updates are required.`,
                                  confirmText: "Understood",
                                  type: "info",
                                  onConfirm: () => {},
                                  icon: <ShieldCheck className="w-8 h-8" />
                                });
                              }
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                          className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-100 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                          <RefreshCw className={cn("w-5 h-5", submitting && "animate-spin")} />
                          CHECK FOR UPDATES
                        </button>
                      )}
                    </div>

                    <button 
                      onClick={handleLogout}
                      className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-100 transition-all flex items-center justify-center gap-3 active:scale-95 border border-red-100"
                    >
                      <LogOut className="w-5 h-5" />
                      LOGOUT ACCOUNT
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Detailed Referral Modal */}
        <AnimatePresence>
          {selectedReferral && (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[100] bg-slate-50 flex flex-col"
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold">Patient File</h2>
                </div>
                <button 
                  onClick={() => setSelectedReferral(null)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
                 <div className="flex-1 overflow-y-auto p-6 pb-24">
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Quick Summary Header */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner",
                        selectedReferral.urgency === 'Emergency' ? 'bg-red-50 text-red-600 shadow-red-100' : 
                        selectedReferral.urgency === 'Urgent' ? 'bg-orange-50 text-orange-600 shadow-orange-100' : 'bg-emerald-50 text-emerald-600 shadow-emerald-100'
                      )}>
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <div>
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-widest",
                          selectedReferral.urgency === 'Emergency' ? 'text-red-500' : 
                          selectedReferral.urgency === 'Urgent' ? 'text-orange-500' : 'text-emerald-500'
                        )}>Priority Level</p>
                        <h2 className="text-2xl font-black tracking-tight">{selectedReferral.urgency}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Referred At</p>
                        <p className="text-xs font-bold text-slate-700">
                          {selectedReferral.timestamp ? new Date(selectedReferral.timestamp.toDate()).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Timeline */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Referral Timeline</h3>
                        <p className="text-xs text-slate-500 font-medium">Tracking lifecycle events</p>
                      </div>
                      <History className="w-5 h-5 text-slate-100" />
                    </div>

                    <div className="relative">
                      {/* Vertical line connecting events */}
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100" />

                      <div className="space-y-8">
                        {/* Event 1: Created */}
                        <div className="relative pl-12">
                          <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-50 border-4 border-white flex items-center justify-center shadow-sm z-10">
                            <Plus className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-slate-900">Referral Created</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                {selectedReferral.timestamp ? new Date(selectedReferral.timestamp.toDate()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Initiated by {selectedReferral.referredBy} at {selectedReferral.fromFacility}</p>
                          </div>
                        </div>

                        {/* Event 2: Sent/Transit (Implicitly when created) */}
                        <div className="relative pl-12">
                          <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-50 border-4 border-white flex items-center justify-center shadow-sm z-10">
                            <MapPin className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-slate-900">Dispatched in Transit</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Done</p>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Destination set to {selectedReferral.destination}</p>
                          </div>
                        </div>

                        {/* Event 3: Arrived */}
                        {selectedReferral.arrivedAt ? (
                          <div className="relative pl-12">
                            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-emerald-50 border-4 border-white flex items-center justify-center shadow-sm z-10">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-slate-900">Arrived at Destination</p>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                                  {new Date(selectedReferral.arrivedAt?.toDate?.() || selectedReferral.arrivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">Checked in at {selectedReferral.destination}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="relative pl-12 opacity-40">
                             <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-100 border-4 border-white flex items-center justify-center shadow-sm z-10">
                              <Clock className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-400">Awaiting Arrival</p>
                              <p className="text-xs text-slate-400 mt-0.5">Waiting for destination facility to confirm receipt</p>
                            </div>
                          </div>
                        )}

                        {/* Event 4: Final Outcome */}
                        {selectedReferral.outcome && selectedReferral.outcome !== 'Arrived at Facility' ? (
                          <div className="relative pl-12">
                            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-900 border-4 border-white flex items-center justify-center shadow-sm z-10">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-slate-900">Outcome Recorded</p>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Completed</p>
                                  {selectedReferral.outcomeAt && (
                                    <p className="text-[9px] font-mono text-slate-400">
                                      {new Date(selectedReferral.outcomeAt?.toDate?.() || selectedReferral.outcomeAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-700 font-medium italic">"{selectedReferral.outcome}"</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative pl-12 opacity-40">
                             <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-100 border-4 border-white flex items-center justify-center shadow-sm z-10">
                              <Clock className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-400">Outcome Pending</p>
                              <p className="text-xs text-slate-400 mt-0.5">Clinical decision still in progress</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Identification Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Patient Identity</p>
                          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{selectedReferral.patientName}</h1>
                        </div>
                        <div className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg shadow-blue-100">
                          ID: {selectedReferral.id.slice(-6).toUpperCase()}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-8">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 text-[10px]">
                            <Calendar className="w-3 h-3" />
                            Patient Age
                          </p>
                          <p className="text-xl font-black text-slate-800">{selectedReferral.age} <span className="text-sm font-bold text-slate-400">Years</span></p>
                        </div>
                        <div className="h-10 w-px bg-slate-100 hidden sm:block" />
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 text-[10px]">
                            <Users className="w-3 h-3" />
                            Gender
                          </p>
                          <p className="text-xl font-black text-slate-800">{selectedReferral.sex}</p>
                        </div>
                      </div>

                      {selectedReferral.sex === 'Female' && (selectedReferral.gravida || selectedReferral.parity || selectedReferral.lmp) && (
                        <div className="mt-8 pt-6 border-t border-slate-50">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Obstetric Background</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {selectedReferral.gravida && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gravida</p>
                                <p className="text-lg font-black text-slate-800">G{selectedReferral.gravida}</p>
                              </div>
                            )}
                            {selectedReferral.parity && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Parity</p>
                                <p className="text-lg font-black text-slate-800">P{selectedReferral.parity}</p>
                              </div>
                            )}
                            {selectedReferral.lmp && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">LMP</p>
                                <p className="text-lg font-black text-slate-800">{new Date(selectedReferral.lmp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                              </div>
                            )}
                            {selectedReferral.gestationAge && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gestation</p>
                                <p className="text-lg font-black text-slate-800">{selectedReferral.gestationAge} <span className="text-xs font-bold text-slate-400 uppercase">Weeks</span></p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl shadow-slate-200 text-white">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Facility Route</p>
                      <div className="space-y-6">
                        <div className="relative pl-6 border-l-2 border-slate-800 pb-1">
                          <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-slate-600" />
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Origin</p>
                              <p className="text-sm font-bold leading-tight">{selectedReferral.fromFacility}</p>
                            </div>
                            {selectedReferral.sentAt && (
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Sent At</p>
                                <p className="text-[10px] font-mono text-slate-400">
                                  {new Date(selectedReferral.sentAt?.toDate?.() || selectedReferral.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="relative pl-6">
                          <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-blue-500" />
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-bold text-blue-500 uppercase">Destination</p>
                              <p className="text-sm font-bold leading-tight">{selectedReferral.destination}</p>
                            </div>
                            {selectedReferral.arrivedAt && (
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase">Arrived At</p>
                                <p className="text-[10px] font-mono text-emerald-400">
                                  {new Date(selectedReferral.arrivedAt?.toDate?.() || selectedReferral.arrivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vitals breakdown */}
                  {selectedReferral.vitals && (selectedReferral.vitals.bp || selectedReferral.vitals.hr || selectedReferral.vitals.rr || selectedReferral.vitals.temp || selectedReferral.vitals.spo2) && (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Clinical Parameters</h3>
                          <p className="text-xs text-slate-500 font-medium">Recorded at point of referral</p>
                        </div>
                        <Activity className="w-5 h-5 text-slate-100" />
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        <VitalCard 
                          icon={<Droplets className="w-3.5 h-3.5" />} 
                          label="BP" 
                          value={selectedReferral.vitals.bp} 
                          unit="mmHg" 
                          color="text-red-600"
                          bgColor="bg-red-50/30"
                        />
                        <VitalCard 
                          icon={<Heart className="w-3.5 h-3.5" />} 
                          label="Heart Rate" 
                          value={selectedReferral.vitals.hr} 
                          unit="bpm"
                          color="text-rose-600"
                          bgColor="bg-rose-50/30"
                        />
                        <VitalCard 
                          icon={<Activity className="w-3.5 h-3.5" />} 
                          label="Resp Rate" 
                          value={selectedReferral.vitals.rr} 
                          unit="bpm"
                          color="text-blue-600"
                          bgColor="bg-blue-50/30"
                        />
                        <VitalCard 
                          icon={<Thermometer className="w-3.5 h-3.5" />} 
                          label="Temp" 
                          value={selectedReferral.vitals.temp} 
                          unit="°C"
                          color="text-orange-600"
                          bgColor="bg-orange-50/30"
                        />
                        <VitalCard 
                          icon={<Fingerprint className="w-3.5 h-3.5" />} 
                          label="SpO2" 
                          value={selectedReferral.vitals.spo2} 
                          unit="%"
                          color="text-cyan-600"
                          bgColor="bg-cyan-50/30"
                        />
                      </div>
                    </div>
                  )}

                  {/* Clinical Need */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Diagnosis / Impression</h3>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-semibold italic text-lg border-l-4 border-blue-500 pl-6 bg-blue-50/30 py-4 rounded-r-2xl">
                          {selectedReferral.diagnosis}
                        </p>
                      </div>

                      {selectedReferral.treatmentGiven && (
                        <div>
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Treatment Given</h3>
                          <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                              {selectedReferral.treatmentGiven}
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedReferral.reasonForReferral && (
                        <div>
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Reason for Referral</h3>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-black text-lg border-l-4 border-amber-500 pl-6 bg-amber-50/30 py-4 rounded-r-2xl italic">
                            {selectedReferral.reasonForReferral}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedReferral.outcome && (
                      <div className="mt-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-4">
                        <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Clinical Outcome</p>
                          <p className="text-md text-emerald-900 font-bold leading-tight">{selectedReferral.outcome}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Patient History Section */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Clinical Timeline</h3>
                        <p className="text-xs text-slate-500 font-medium">Previous occurrences</p>
                      </div>
                      <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black">
                        {patientHistory.length} ENTRIES
                      </span>
                    </div>
                    
                    {patientHistory.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm text-slate-400 font-bold tracking-tight">Zero Clinical History Recorded</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-medium">No previous referrals for this identity</p>
                      </div>
                    ) : (
                      <div className="relative pl-6 border-l-2 border-slate-50 space-y-6">
                        {patientHistory.map((hist) => (
                          <div key={hist.id} className="relative group">
                            <div className="absolute left-[-33px] top-1 w-4 h-4 rounded-full bg-white border-4 border-slate-200 group-hover:border-blue-500 transition-colors" />
                            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <p className="text-xs font-black text-slate-900 tracking-tight">{new Date(hist.timestamp?.toDate()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{hist.fromFacility} → {hist.destination}</p>
                                </div>
                                <span className={cn(
                                  "text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tight",
                                  hist.urgency === 'Emergency' ? 'bg-red-100 text-red-600' : 
                                  hist.urgency === 'Urgent' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                                )}>
                                  {hist.urgency}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium italic border-l-2 border-slate-200 pl-3 leading-relaxed">"{hist.diagnosis}"</p>
                              {hist.outcome && (
                                <p className="mt-3 text-[10px] text-emerald-600 font-black flex items-center gap-1.5 uppercase tracking-wide bg-emerald-50 w-fit px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Outcome: {hist.outcome}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outcome Update UI */}
                  {(isAdmin || selectedReferral.referredByUid === user?.uid || profile?.facility === selectedReferral.destination) && (
                    <div className="space-y-4">
                      {profile?.facility === selectedReferral.destination && !selectedReferral.arrivedAt && (
                        <button 
                          onClick={() => handleMarkAsArrived(selectedReferral.id)}
                          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition flex items-center justify-center gap-2 animate-pulse"
                        >
                          <MapPin className="w-5 h-5" />
                          Stamp Arrival Time
                        </button>
                      )}

                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Update Outcome</h3>
                        <div className="space-y-3">
                          <textarea 
                            placeholder="What happened? (e.g., Arrived, Admitted, Discharged, Deceased)"
                            value={outcomeInput}
                            onChange={(e) => setOutcomeInput(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows={2}
                          />
                          <button 
                            onClick={() => handleUpdateOutcome(selectedReferral.id, outcomeInput)}
                            disabled={!outcomeInput || outcomeInput === selectedReferral.outcome}
                            className="w-full py-3 bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Save Outcome
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {(isAdmin || selectedReferral.referredByUid === user?.uid) && (
                    <div className="pt-4 border-t border-slate-200">
                      <button 
                        onClick={() => {
                          setDeleteConfirmId(selectedReferral.id);
                        }}
                        className="w-full py-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
                      >
                        <Trash2 className="w-5 h-5" />
                        Cancel / Delete Referral
                      </button>
                      <p className="text-center text-[10px] text-slate-500 mt-3 px-4">
                        You can cancel this referral if the patient situation changes (e.g., patient passed away in transit or sent by mistake).
                      </p>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transfer User Modal */}
        <AnimatePresence>
          {transferUser && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-8 pb-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-50 rounded-2xl">
                      <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 leading-tight">Transfer Staff</h2>
                      <p className="text-sm text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">{transferUser.name}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
                    Moving staff from <span className="font-bold text-slate-900 italic">{transferUser.facility}</span> to a new location.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Province</label>
                      <select 
                        value={selectedProvince}
                        onChange={(e) => {
                          setSelectedProvince(e.target.value);
                          setSelectedDistrict('');
                          setSelectedFacility('');
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-800"
                      >
                        <option value="">Select Province</option>
                        {Object.keys(ZAMBIA_DATA).sort().map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className={cn(!selectedProvince && "opacity-50 pointer-events-none")}>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">District Area</label>
                      <select 
                        value={selectedDistrict}
                        onChange={(e) => {
                          setSelectedDistrict(e.target.value);
                          setSelectedFacility('');
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-800"
                      >
                        <option value="">Select District</option>
                        {selectedProvince && ZAMBIA_DATA[selectedProvince] && Object.keys(ZAMBIA_DATA[selectedProvince]).sort().map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div className={cn(!selectedDistrict && "opacity-50 pointer-events-none")}>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Target Facility</label>
                      <select 
                        value={selectedFacility}
                        onChange={(e) => setSelectedFacility(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-800"
                      >
                        <option value="">Select Facility</option>
                        {selectedProvince && selectedDistrict && (ZAMBIA_DATA[selectedProvince]?.[selectedDistrict]?.sort() || []).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 flex gap-3">
                  <button 
                    onClick={() => setTransferUser(null)}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-100 transition active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!selectedProvince || !selectedDistrict || !selectedFacility}
                    onClick={() => handleUpdateUserLocation(transferUser?.id || '', selectedProvince, selectedDistrict, selectedFacility)}
                    className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-black text-sm hover:bg-blue-600 shadow-xl shadow-sky-100 transition active:scale-95 disabled:opacity-50"
                  >
                    Transfer Now
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toastError && (
            <ErrorNotification 
              message={toastError} 
              onClear={() => setToastError(null)} 
            />
          )}
        </AnimatePresence>

        {/* Bottom Navigation */}
        {user && page !== Page.ONBOARDING && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center shadow-lg z-[100]">
            <button 
              onClick={() => setPage(Page.DASHBOARD)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors px-4 py-1 rounded-md",
                page === Page.DASHBOARD ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Home</span>
            </button>
            <button 
              onClick={() => setPage(Page.DIRECTORY)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors px-4 py-1 rounded-md",
                page === Page.DIRECTORY ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Hospital className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Directory</span>
            </button>
            <button 
              onClick={() => setPage(Page.FORM)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors px-6 py-1 rounded-md bg-blue-500 text-white shadow-md hover:bg-blue-600",
                page === Page.FORM ? "ring-4 ring-blue-100" : ""
              )}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">New</span>
            </button>
            <button 
              onClick={() => setPage(Page.MAP)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors px-4 py-1 rounded-md",
                page === Page.MAP ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <MapIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Map</span>
            </button>
            <button 
              onClick={() => setPage(Page.PROFILE)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors px-4 py-1 rounded-md",
                page === Page.PROFILE ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Profile</span>
            </button>
            {isAdmin && (
              <button 
                onClick={() => setPage(Page.ADMIN)}
                className={cn(
                  "flex flex-col items-center gap-1 transition-colors px-4 py-1 rounded-md",
                  page === Page.ADMIN ? "text-purple-600 bg-purple-50" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Admin</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  </ErrorBoundary>
);
}
