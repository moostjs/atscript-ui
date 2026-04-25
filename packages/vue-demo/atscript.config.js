import ts from "@atscript/typescript";
import dbPlugin from "@atscript/db/plugin";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";
import wfPlugin from "@atscript/moost-wf/plugin";

export default {
  plugins: [ts(), dbPlugin(), uiPlugin(), uiFnsPlugin(), wfPlugin()],
};
