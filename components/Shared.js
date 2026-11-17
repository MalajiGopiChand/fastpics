'use client';
import { useEffect, useRef } from 'react';
import { Aperture, X, LoaderCircle } from 'lucide-react';
export function Brand() { return <span className="brand"><span className="brand-symbol"><Aperture size={25}/></span>fastpics<span className="brand-dot">.</span></span>; }
export function Spinner({children='Working…'}) { return <span className="spinner"><LoaderCircle size={18}/>{children}</span>; }
export function Modal({title,children,onClose,wide=false}) {
  const ref=useRef();
  useEffect(()=>{ref.current.showModal();},[]);
  return <dialog className={`modal ${wide?'wide':''}`} ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export const formatSize = bytes => bytes>=1e9?`${(bytes/1e9).toFixed(2)} GB`:bytes>=1e6?`${(bytes/1e6).toFixed(1)} MB`:`${Math.round(bytes/1000)} KB`;
export function dateLabel(date) { return new Date(`${date}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
export async function downloadPhoto(photo) {
  const res=await fetch(photo.url); if(!res.ok)throw new Error('Download link expired. Find your photos again to refresh it.');
  const blob=await res.blob(), url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=photo.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
