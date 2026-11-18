import {requireUser,json,apiError} from '../../../lib/server';
import {accountAccess} from '../../../lib/access.mjs';
export async function GET(request){try{const {user}=await requireUser(request);return json(accountAccess(user));}catch(e){return apiError(e);}}
