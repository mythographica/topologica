declare type TopDef = {
    name: string;
    path: string;
    type: CallableFunction;
    kids: TopDef[];
};
declare type LoaderOutput = {
    topology?: TopDef;
    logs?: string[][];
};
declare const loader: (topologyPath: string, define: CallableFunction, checker?: CallableFunction | undefined) => LoaderOutput;
export default loader;
