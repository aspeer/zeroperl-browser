use strict;
use warnings;
use Test::More;
use File::Spec;
use FindBin;

my $source_dn=$ENV{'WEBDYNE_SOURCE'};
plan(skip_all => 'set WEBDYNE_SOURCE to a WebDyne source checkout') unless $source_dn;
my $app_dn=File::Spec->catdir($FindBin::Bin, '..', 'examples', 'basic', 'app');

foreach my $page (qw(app next events)) {
    my ($status, $output)=run_tool('wdlint', File::Spec->catfile($app_dn, $page.'.psp'));
    is($status, 0, $page.' passes native Perl syntax checks');
}

my ($status, $output)=run_tool('wdrender', '--no-lineno', File::Spec->catfile($app_dn, 'app.psp'));
is($status, 0, 'home renders natively');
like($output, qr/Visits in this interpreter: 1/, 'native handler renders visit count');
($status, $output)=run_tool('wdrender', '--no-lineno', '--get', 'name=Alice', File::Spec->catfile($app_dn, 'next.psp'));
is($status, 0, 'parameterized page renders natively');
like($output, qr/Hello, Alice/, 'native CGI parameter is rendered');

done_testing();


sub run_tool {
    my ($tool, @arg)=@_;
    my $tool_pn=File::Spec->catfile($source_dn, 'bin', $tool);
    my $lib_dn=File::Spec->catdir($source_dn, 'lib');
    open(my $output_fh, '-|', $^X, '-I'.$lib_dn, $tool_pn, @arg) || die($!);
    local $/;
    my $output=<$output_fh>;
    close($output_fh);
    return ($? >> 8, $output);
}
