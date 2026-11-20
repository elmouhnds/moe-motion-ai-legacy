/*
 * MOE Quick - opens MOE Motion AI's pie + search over After Effects (docs/features/QUICK_APPLY.md).
 * Copy this file into After Effects' Scripts folder, then run it from File > Scripts or give it a keyboard shortcut.
 * It only sends a CSXS event (CEP: PlugPlugExternalObject + CSXSEvent) to the MOE Motion AI panel, which must be open
 * (docked anywhere). ExtendScript / ES3, ASCII only.
 */
(function () {
    try {
        var lib = new ExternalObject('lib:PlugPlugExternalObject');
        var e = new CSXSEvent();
        e.type = 'tv.madtomato.moe.quick.request';
        e.data = '';
        e.dispatch();
    } catch (err) {
        alert('MOE Quick: open MOE Motion AI once (Window > Extensions > MOE Motion AI) so it can listen.\n' + err);
    }
}());
