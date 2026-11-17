import GuestGallery from '../../../components/GuestGallery';
export default async function GuestPage({params}) { const {token}=await params;return <GuestGallery token={token}/>; }
