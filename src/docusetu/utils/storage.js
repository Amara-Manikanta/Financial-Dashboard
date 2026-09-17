export function getScenarioStats(scenarioId, documents, progressMap) {
    const scenarioProgress = progressMap[scenarioId] || {};
    const totalCount = documents.length;
    const claimedCount = documents.filter((doc) => scenarioProgress[doc.id]?.isClaimed).length;
    const percentage = totalCount > 0 ? Math.round((claimedCount / totalCount) * 100) : 0;
    const isComplete = totalCount > 0 && claimedCount === totalCount;
    return {
        totalCount,
        claimedCount,
        percentage,
        isComplete,
    };
}
export function getOverallStats(scenarios, progressMap) {
    let totalDocs = 0;
    let totalClaimed = 0;
    let activeScenarios = 0;
    scenarios.forEach((sc) => {
        totalDocs += sc.documents.length;
        const scProgress = progressMap[sc.id] || {};
        const claimedInSc = sc.documents.filter((d) => scProgress[d.id]?.isClaimed).length;
        totalClaimed += claimedInSc;
        if (claimedInSc > 0) {
            activeScenarios++;
        }
    });
    return {
        totalDocs,
        totalClaimed,
        activeScenarios,
        overallPercentage: totalDocs > 0 ? Math.round((totalClaimed / totalDocs) * 100) : 0,
    };
}
export function generateWhatsAppSummary(scenario, progressMap) {
    const scProgress = progressMap[scenario.id] || {};
    const stats = getScenarioStats(scenario.id, scenario.documents, progressMap);
    let text = `📋 *DocuSetu Checklist: ${scenario.title}*\n`;
    text += `📊 Progress: ${stats.claimedCount}/${stats.totalCount} documents claimed (${stats.percentage}%)\n\n`;
    text += `*DOCUMENTS STATUS:*\n`;
    scenario.documents.forEach((doc, idx) => {
        const isClaimed = !!scProgress[doc.id]?.isClaimed;
        const note = scProgress[doc.id]?.personalNote;
        const icon = isClaimed ? '✅ [CLAIMED]' : '⏳ [PENDING]';
        text += `${idx + 1}. ${icon} *${doc.title}*\n`;
        text += `   • Type: ${doc.type.replace('_', ' ').toUpperCase()} | Req: ${doc.importance}\n`;
        if (note) {
            text += `   • Note/Location: ${note}\n`;
        }
    });
    if (scenario.dueDiligenceTips.length > 0) {
        text += `\n⚠️ *CRUCIAL RED FLAG TIP:*\n• ${scenario.dueDiligenceTips[0]}\n`;
    }
    text += `\nCreated with DocuSetu - Citizen Document Companion`;
    return encodeURIComponent(text);
}
