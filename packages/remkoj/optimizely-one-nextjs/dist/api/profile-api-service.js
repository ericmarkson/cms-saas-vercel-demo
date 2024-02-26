import * as EnvTools from '../utils/env';
import EnvVars from '../env-vars';
import * as Responses from './responses';
import Session from '../utils/session';
import { DataPlatform, ContentRecs, WebExperimentation } from '../products';
const NO_ID = 'n/a';
export const ProfileApiService = {
    for: { path: '/', verb: 'get' },
    handler: async (query, cookies) => {
        // Check if the toolkit is enabled
        if (!EnvTools.readValueAsBoolean(EnvVars.HelperEnabled, false))
            return Responses.NotFound;
        // Start timer
        let start = Date.now();
        // Read requested scopes
        const scopes = query.get('scope')?.toLowerCase()?.split(',')?.map(x => x.trim());
        const fetchContentTopics = !scopes || scopes.includes('topics');
        const fetchODPAudiences = !scopes || scopes.includes('audiences');
        // Read all IDs
        const odpId = DataPlatform.Tools.getVisitorID(cookies);
        const crId = ContentRecs.Tools.getVisitorID(cookies);
        const webExId = WebExperimentation.Tools.getVisitorID(cookies);
        const frontendId = Session.getVisitorId(cookies);
        // Determine audiences if needed
        let audiences = [];
        if (fetchODPAudiences && odpId) {
            const odp = new DataPlatform.Client();
            const allAudiences = await odp.getAllAudiences();
            // Split the list into manageable groups
            const chunks = [];
            allAudiences.forEach((item, idx) => {
                const chunkId = Math.floor(idx / EnvTools.readValueAsInt(EnvVars.OdpAudienceBatchSize, 30));
                chunks[chunkId] = chunks[chunkId] || [];
                chunks[chunkId].push(item.id);
            });
            // Apply filtering to the audiences
            const userAudienceIds = (await Promise.all(chunks.map(chunk => odp.filterAudiences(odpId, chunk)))).flat();
            audiences = allAudiences.filter(a => userAudienceIds.includes(a.id));
        }
        // Determine topics if needed
        let topics = [];
        if (fetchContentTopics && crId) {
            const contentRecs = new ContentRecs.Client();
            topics = await contentRecs.getContentTopics(crId);
        }
        return [{
                ids: {
                    dataPlatform: odpId || NO_ID,
                    frontend: frontendId || NO_ID,
                    contentIntelligence: crId || NO_ID,
                    webExperimentation: webExId || NO_ID
                },
                audiences: audiences,
                contentTopics: topics,
                duration: `${Date.now() - start}ms`
            }, 200];
    }
};
export default ProfileApiService;
