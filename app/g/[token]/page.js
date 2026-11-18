import GuestGallery from '../../../components/GuestGallery';
import AppBootstrap from '../../../components/AppBootstrap';
export default async function GuestPage({params}) { const {token}=await params;return <AppBootstrap guest><GuestGallery token={token}/></AppBootstrap>; }
